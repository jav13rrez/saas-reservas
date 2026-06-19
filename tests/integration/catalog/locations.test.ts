/**
 * Location CRUD over the canonical layer: LocationService manages the multi-site
 * "ubicaciones" that root the admin assignment chain. Exercised over the
 * in-memory adapter (always) and the Drizzle/RLS adapter (self-skips without
 * PostgreSQL).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import {
  LocationService,
  type LocationRepository,
} from "@saas-reservas/api/application/catalog/location-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import { DEFAULT_POLICIES, type Tenant } from "@saas-reservas/domain/tenancy/tenant";
import {
  createTenantDb,
  DrizzleLocationRepository,
  DrizzleTenantRepository,
  type TenantDb,
} from "@saas-reservas/persistence";
import { setupDomainDb } from "../helpers/domain-db.js";
import { ADMIN_URL } from "../helpers/postgres.js";

const TENANT = "00000000-0000-4000-8000-000000000d01";

const actor = { kind: "staff", id: "00000000-0000-4000-8000-000000000d99" } as const;

const tenant: Tenant = {
  id: TENANT,
  slug: "loc-test",
  displayName: "Location Test",
  status: "active",
  defaultTimezone: "Europe/Madrid",
  defaultLocale: "es-ES",
  branding: { primaryColor: "#000000" },
  policies: DEFAULT_POLICIES,
};

/** Shared behavioral contract for any LocationRepository implementation. */
function locationContract(makeRepo: () => Promise<LocationRepository>): void {
  it("creates, lists, and toggles locations with audit records", async () => {
    const repo = await makeRepo();
    const events = new InMemoryEventSink();
    const service = new LocationService(repo, events);

    const centro = await service.createLocation({
      tenantId: TENANT,
      name: "Sede Centro",
      timezone: "Europe/Madrid",
      address: "Calle Mayor 1",
      actor,
    });
    expect(centro.status).toBe("active");
    expect(centro.timezone).toBe("Europe/Madrid");

    // Optional fields stay absent when not provided.
    const norte = await service.createLocation({ tenantId: TENANT, name: "Sede Norte", actor });
    expect(norte.timezone).toBeUndefined();
    expect(norte.address).toBeUndefined();

    const listed = await service.listLocations(TENANT);
    expect(listed.map((l) => l.name).sort()).toEqual(["Sede Centro", "Sede Norte"]);

    const toggled = await service.setLocationActive({
      tenantId: TENANT,
      locationId: centro.id,
      active: false,
      actor,
    });
    expect(toggled?.status).toBe("inactive");

    const missing = await service.setLocationActive({
      tenantId: TENANT,
      locationId: "00000000-0000-4000-8000-0000000000ff",
      active: false,
      actor,
    });
    expect(missing).toBeNull();

    expect(events.audits.map((a) => a.action)).toEqual([
      "catalog.location-created",
      "catalog.location-created",
      "catalog.location-updated",
    ]);
  });

  it("rejects an invalid timezone", async () => {
    const repo = await makeRepo();
    const service = new LocationService(repo, new InMemoryEventSink());
    await expect(
      service.createLocation({
        tenantId: TENANT,
        name: "Bad",
        timezone: "Not/AZone",
        actor,
      }),
    ).rejects.toThrow();
  });
}

describe("LocationService over in-memory adapter", () => {
  locationContract(() => Promise.resolve(new InMemoryStore()));
});

const fixture = await setupDomainDb("loc");

if (fixture === null) {
  describe.skip(`LocationService over Drizzle (PostgreSQL not reachable at ${ADMIN_URL})`, () => {
    it("skipped", () => undefined);
  });
} else {
  describe("LocationService over Drizzle/RLS adapter", () => {
    let db: TenantDb;

    beforeAll(async () => {
      db = createTenantDb(fixture.appUrl);
      await new DrizzleTenantRepository(db).insertTenant(tenant);
    });

    afterAll(async () => {
      await db.close();
    });

    locationContract(() => Promise.resolve(new DrizzleLocationRepository(db)));
  });
}
