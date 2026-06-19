/**
 * Customer registry over the canonical layer (ADR-0018 Phase 2): CustomerService
 * makes customers first-class for the admin console over the `customers` table.
 * Exercised over the in-memory adapter (always) and the Drizzle/RLS adapter
 * (self-skips without PostgreSQL).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import {
  CustomerService,
  DuplicateCustomerEmailError,
  type CustomerRegistryRepository,
} from "@saas-reservas/api/application/customers/customer-service";
import { InMemoryPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-payment-store";
import { DEFAULT_POLICIES, type Tenant } from "@saas-reservas/domain/tenancy/tenant";
import {
  createTenantDb,
  DrizzlePaymentRepository,
  DrizzleTenantRepository,
  type TenantDb,
} from "@saas-reservas/persistence";
import { setupDomainDb } from "../helpers/domain-db.js";
import { ADMIN_URL } from "../helpers/postgres.js";

const TENANT = "00000000-0000-4000-8000-000000000e01";
const actor = { kind: "staff", id: "00000000-0000-4000-8000-000000000e99" } as const;

const tenant: Tenant = {
  id: TENANT,
  slug: "cust-test",
  displayName: "Customer Test",
  status: "active",
  defaultTimezone: "Europe/Madrid",
  defaultLocale: "es-ES",
  branding: { primaryColor: "#000000" },
  policies: DEFAULT_POLICIES,
};

function registryContract(makeRepo: () => Promise<CustomerRegistryRepository>): void {
  it("registers and lists customers, normalizing email and splitting names", async () => {
    const repo = await makeRepo();
    const events = new InMemoryEventSink();
    const service = new CustomerService(repo, events);

    const lucia = await service.createCustomer({
      tenantId: TENANT,
      email: "Lucia@Example.com",
      firstName: "Lucía",
      lastName: "Romero",
      phone: "+34 600 111 222",
      actor,
    });
    expect(lucia.email).toBe("lucia@example.com");
    expect(lucia.gdprStatus).toBe("active");
    expect(lucia.phone).toBe("+34 600 111 222");

    const listed = await service.listCustomers(TENANT);
    expect(listed.map((c) => c.email)).toEqual(["lucia@example.com"]);

    expect(events.audits.map((a) => a.action)).toEqual(["registry.customer-created"]);
  });

  it("rejects a duplicate email (case-insensitive)", async () => {
    const repo = await makeRepo();
    const service = new CustomerService(repo, new InMemoryEventSink());
    await service.createCustomer({
      tenantId: TENANT,
      email: "dup@example.com",
      firstName: "A",
      lastName: "B",
      actor,
    });
    await expect(
      service.createCustomer({
        tenantId: TENANT,
        email: "DUP@example.com",
        firstName: "C",
        lastName: "D",
        actor,
      }),
    ).rejects.toBeInstanceOf(DuplicateCustomerEmailError);
  });
}

describe("CustomerService over in-memory adapter", () => {
  registryContract(() => Promise.resolve(new InMemoryPaymentStore()));
});

const fixture = await setupDomainDb("cust");

if (fixture === null) {
  describe.skip(`CustomerService over Drizzle (PostgreSQL not reachable at ${ADMIN_URL})`, () => {
    it("skipped", () => undefined);
  });
} else {
  describe("CustomerService over Drizzle/RLS adapter", () => {
    let db: TenantDb;

    beforeAll(async () => {
      db = createTenantDb(fixture.appUrl);
      await new DrizzleTenantRepository(db).insertTenant(tenant);
    });

    afterAll(async () => {
      await db.close();
    });

    registryContract(() => Promise.resolve(new DrizzlePaymentRepository(db)));
  });
}
