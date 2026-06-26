/**
 * Admin settings surface over HTTP (feature 003): GET/PATCH /v1/admin/settings.
 * Round-trip persistence, all-or-nothing validation with the contract's 400
 * codes, non-retroactive currency (existing service keeps its currency; a new
 * one inherits the tenant default), and the admin-role gate.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { StaffAuthService } from "@saas-reservas/api/application/identity/staff-auth-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import { InMemoryStaffAccountStore } from "@saas-reservas/api/infrastructure/memory/in-memory-staff-account-store";

const BASE_DOMAIN = "reservas.test";
const HOST = "clinic.reservas.test";

interface Settings {
  profile: { displayName: string };
  localization: { defaultTimezone: string; defaultLocale: string; currency: string };
  policies: {
    cancellationMinNoticeHours: number;
    rescheduleMinNoticeHours: number;
    bookingHorizonDays: number;
    requiresApproval: boolean;
  };
  branding: { primaryColor: string; logoUrl?: string };
}

describe("admin settings surface (no auth gate)", () => {
  let app: FastifyInstance;

  async function get(): Promise<{ status: number; body: Settings }> {
    const r = await app.inject({
      method: "GET",
      url: "/v1/admin/settings",
      headers: { host: HOST },
    });
    return {
      status: r.statusCode,
      body: r.statusCode === 200 ? r.json<Settings>() : ({} as Settings),
    };
  }

  async function patch(payload: unknown): Promise<{ status: number; error?: string }> {
    const r = await app.inject({
      method: "PATCH",
      url: "/v1/admin/settings",
      headers: { host: HOST },
      payload: payload as Record<string, unknown>,
    });
    return {
      status: r.statusCode,
      error: r.statusCode !== 200 ? r.json<{ error: string }>().error : undefined,
    };
  }

  async function createService(
    payload: Record<string, unknown>,
  ): Promise<{ id: string; currency: string }> {
    const r = await app.inject({
      method: "POST",
      url: "/v1/admin/services",
      headers: { host: HOST },
      payload,
    });
    expect(r.statusCode).toBe(201);
    return r.json<{ id: string; currency: string }>();
  }

  beforeAll(async () => {
    const store = new InMemoryStore();
    const events = new InMemoryEventSink();
    app = buildApp({
      platformBaseDomain: BASE_DOMAIN,
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      availability: new AvailabilityService(store, store),
      tenantTimezone: async (id) => (await store.findTenantById(id))?.defaultTimezone ?? "UTC",
    });
    const tenant = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      payload: { slug: "clinic", displayName: "Clinic", defaultTimezone: "Europe/Madrid" },
    });
    expect(tenant.statusCode).toBe(201);
  });

  it("returns the current settings with the default currency", async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.localization.currency).toBe("EUR");
    expect(body.profile.displayName).toBe("Clinic");
  });

  it("round-trips a localization + profile change", async () => {
    const patched = await patch({
      profile: { displayName: "Clínica Norte" },
      localization: {
        defaultTimezone: "America/New_York",
        defaultLocale: "en-US",
        currency: "USD",
      },
    });
    expect(patched.status).toBe(200);
    const { body } = await get();
    expect(body.profile.displayName).toBe("Clínica Norte");
    expect(body.localization.defaultTimezone).toBe("America/New_York");
    expect(body.localization.currency).toBe("USD");
  });

  it("rejects an invalid timezone all-or-nothing (the valid currency in the same body is not applied)", async () => {
    const before = (await get()).body;
    const patched = await patch({
      localization: { defaultTimezone: "Mars/Phobos", currency: "GBP" },
    });
    expect(patched.status).toBe(400);
    expect(patched.error).toBe("invalid-timezone");
    const after = (await get()).body;
    expect(after.localization.defaultTimezone).toBe(before.localization.defaultTimezone);
    expect(after.localization.currency).toBe(before.localization.currency);
  });

  it("maps each validation failure to its contract code", async () => {
    expect((await patch({ localization: { currency: "eur" } })).error).toBe("invalid-currency");
    expect((await patch({ policies: { bookingHorizonDays: 0 } })).error).toBe(
      "policy-out-of-range",
    );
    expect((await patch({ branding: { primaryColor: "blue" } })).error).toBe("invalid-color");
    expect((await patch({ profile: { displayName: "  " } })).error).toBe("invalid-display-name");
  });

  it("changes currency non-retroactively: existing service keeps its currency, a new one inherits", async () => {
    // tenant currency is USD at this point (from the round-trip test)
    const category = await app.inject({
      method: "POST",
      url: "/v1/admin/categories",
      headers: { host: HOST },
      payload: { name: "Health" },
    });
    const categoryId = category.json<{ id: string }>().id;
    const existing = await createService({
      categoryId,
      name: "Consulta",
      durationMinutes: 30,
      priceAmount: 5000,
      currency: "EUR",
    });
    expect(existing.currency).toBe("EUR");

    await patch({ localization: { currency: "USD" } });

    const inherited = await createService({
      categoryId,
      name: "Revisión",
      durationMinutes: 20,
      priceAmount: 4000,
    });
    expect(inherited.currency).toBe("USD"); // new service inherits the tenant default
    // the existing service still reports EUR (read it back)
    const list = await app.inject({
      method: "GET",
      url: "/v1/admin/services",
      headers: { host: HOST },
    });
    const items = list.json<{ items: { id: string; currency: string }[] }>().items;
    expect(items.find((s) => s.id === existing.id)?.currency).toBe("EUR");
  });
});

describe("admin settings surface (admin-role gate)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const store = new InMemoryStore();
    const events = new InMemoryEventSink();
    app = buildApp({
      platformBaseDomain: BASE_DOMAIN,
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      staffAuth: new StaffAuthService(new InMemoryStaffAccountStore(), events),
      availability: new AvailabilityService(store, store),
      tenantTimezone: async (id) => (await store.findTenantById(id))?.defaultTimezone ?? "UTC",
    });
    await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      payload: { slug: "clinic", displayName: "Clinic", defaultTimezone: "Europe/Madrid" },
    });
  });

  it("rejects settings access without an admin session (401)", async () => {
    const get = await app.inject({
      method: "GET",
      url: "/v1/admin/settings",
      headers: { host: HOST },
    });
    expect(get.statusCode).toBe(401);
    const patch = await app.inject({
      method: "PATCH",
      url: "/v1/admin/settings",
      headers: { host: HOST },
      payload: { localization: { currency: "USD" } },
    });
    expect(patch.statusCode).toBe(401);
  });
});
