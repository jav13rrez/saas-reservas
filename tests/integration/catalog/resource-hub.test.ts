/**
 * Resource hub model (ADR-0016) over the canonical layer: the ResourceHubService
 * configures resource-owned associations and the allocation read model resolves
 * eligible resources via the domain hub helper. Exercised over the in-memory
 * adapter (always) and the Drizzle/RLS adapter (self-skips without PostgreSQL).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import {
  ResourceHubService,
  type ResourceHubRepository,
} from "@saas-reservas/api/application/catalog/resource-hub-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import { hubResourcesForBooking } from "@saas-reservas/domain/catalog/resource-hub";
import type { Resource } from "@saas-reservas/domain/catalog/service";
import { DEFAULT_POLICIES, type Tenant } from "@saas-reservas/domain/tenancy/tenant";
import {
  createTenantDb,
  DrizzleResourceHubRepository,
  DrizzleTenantRepository,
  schema,
  type TenantDb,
} from "@saas-reservas/persistence";
import { setupDomainDb } from "../helpers/domain-db.js";
import { ADMIN_URL } from "../helpers/postgres.js";

const TENANT = "00000000-0000-4000-8000-000000000abc";
const THERAPY = "00000000-0000-4000-8000-0000000000a1";
const CONSULTA = "00000000-0000-4000-8000-0000000000a2";
const CENTRO = "00000000-0000-4000-8000-0000000000b1";
const NORTE = "00000000-0000-4000-8000-0000000000b2";
const ANA = "00000000-0000-4000-8000-0000000000c1";
const LUIS = "00000000-0000-4000-8000-0000000000c2";

const actor = { kind: "staff", id: ANA } as const;

const tenant: Tenant = {
  id: TENANT,
  slug: "hub-test",
  displayName: "Hub Test",
  status: "active",
  defaultTimezone: "Europe/Madrid",
  defaultLocale: "es-ES",
  branding: { primaryColor: "#000000" },
  policies: DEFAULT_POLICIES,
};

function makeResource(id: string, name: string): Resource {
  return { id, tenantId: TENANT, name, quantity: 1, status: "active" };
}

interface HubHarness {
  repo: ResourceHubRepository;
  /** Persist an active resource and return its id. */
  seedResource: (name: string) => Promise<string>;
}

/** Shared behavioral contract for any ResourceHubRepository implementation. */
function hubContract(makeHarness: () => Promise<HubHarness>): void {
  it("round-trips associations and resolves eligible resources for a booking", async () => {
    const { repo, seedResource } = await makeHarness();
    const events = new InMemoryEventSink();
    const service = new ResourceHubService(repo, events);

    const therapyRoom = await seedResource("Sala terapia");
    const sharedRoom = await seedResource("Sala compartida");

    await service.setServices({
      tenantId: TENANT,
      resourceId: therapyRoom,
      serviceIds: [THERAPY],
      actor,
    });
    await service.setLocations({
      tenantId: TENANT,
      resourceId: therapyRoom,
      locationIds: [CENTRO],
      actor,
    });
    await service.setEmployees({
      tenantId: TENANT,
      resourceId: therapyRoom,
      providerIds: [ANA],
      actor,
    });
    // Shared room: any location, any provider, two services.
    await service.setServices({
      tenantId: TENANT,
      resourceId: sharedRoom,
      serviceIds: [THERAPY, CONSULTA],
      actor,
    });

    const hub = await service.getHub(TENANT, therapyRoom);
    expect(hub).toEqual({ serviceIds: [THERAPY], locationIds: [CENTRO], employeeIds: [ANA] });

    // Audit emitted for each mutation.
    expect(events.audits.map((a) => a.action)).toEqual([
      "catalog.resource-services-updated",
      "catalog.resource-locations-updated",
      "catalog.resource-employees-updated",
      "catalog.resource-services-updated",
    ]);

    const forService = await service.listResourcesForService(TENANT, THERAPY);
    const hubs = forService.map((row) => ({ resourceId: row.resource.id, ...row.hub }));

    // Ana at Centro can use both rooms; Luis at Norte only the shared room.
    expect(
      hubResourcesForBooking(hubs, {
        serviceId: THERAPY,
        providerId: ANA,
        locationIds: [CENTRO],
      })
        .map((h) => h.resourceId)
        .sort(),
    ).toEqual([therapyRoom, sharedRoom].sort());

    expect(
      hubResourcesForBooking(hubs, {
        serviceId: THERAPY,
        providerId: LUIS,
        locationIds: [NORTE],
      }).map((h) => h.resourceId),
    ).toEqual([sharedRoom]);
  });

  it("replaces associations rather than appending", async () => {
    const { repo, seedResource } = await makeHarness();
    const events = new InMemoryEventSink();
    const service = new ResourceHubService(repo, events);
    const room = await seedResource("Sala");

    await service.setServices({ tenantId: TENANT, resourceId: room, serviceIds: [THERAPY], actor });
    await service.setServices({
      tenantId: TENANT,
      resourceId: room,
      serviceIds: [CONSULTA],
      actor,
    });

    const hub = await service.getHub(TENANT, room);
    expect(hub.serviceIds).toEqual([CONSULTA]);
  });
}

describe("ResourceHubService over in-memory adapter", () => {
  hubContract(() => {
    const store = new InMemoryStore();
    return Promise.resolve({
      repo: store,
      seedResource: async (name) => {
        const id = randomUUID();
        await store.insertResource(makeResource(id, name));
        return id;
      },
    });
  });
});

const fixture = await setupDomainDb("hub");

if (fixture === null) {
  describe.skip(`ResourceHubService over Drizzle (PostgreSQL not reachable at ${ADMIN_URL})`, () => {
    it("skipped", () => undefined);
  });
} else {
  describe("ResourceHubService over Drizzle/RLS adapter", () => {
    let db: TenantDb;

    beforeAll(async () => {
      db = createTenantDb(fixture.appUrl);
      await new DrizzleTenantRepository(db).insertTenant(tenant);
    });

    afterAll(async () => {
      await db.close();
    });

    hubContract(() =>
      Promise.resolve({
        repo: new DrizzleResourceHubRepository(db),
        seedResource: async (name) => {
          const id = randomUUID();
          await db.withTenant(TENANT, (tx) =>
            tx.insert(schema.resources).values(makeResource(id, name)),
          );
          return id;
        },
      }),
    );
  });
}
