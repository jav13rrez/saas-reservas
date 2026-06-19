/**
 * Admin read-model endpoints (console listing surface): the persistent API now
 * exposes GET /v1/admin/{categories,services,providers,resources} so the admin
 * console can render from the real backend instead of its in-memory demo store.
 *
 * Providers come enriched with their service assignments and work locations;
 * resources come enriched with their hub associations (ADR-0016).
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { LocationService } from "@saas-reservas/api/application/catalog/location-service";
import { ResourceHubService } from "@saas-reservas/api/application/catalog/resource-hub-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";

const BASE_DOMAIN = "reservas.test";
const TENANT_HOST = "clinic.reservas.test";

interface Created {
  id: string;
}

interface ListBody<T> {
  items: T[];
}

describe("admin read-model endpoints", () => {
  let app: FastifyInstance;
  let store: InMemoryStore;
  let serviceId: string;
  let providerId: string;
  let resourceId: string;
  let locationId: string;

  async function adminPost(url: string, payload: unknown): Promise<Created> {
    const response = await app.inject({
      method: "POST",
      url,
      headers: { host: TENANT_HOST },
      payload: payload as Record<string, unknown>,
    });
    expect([201, 204]).toContain(response.statusCode);
    return response.statusCode === 201 ? response.json<Created>() : { id: "" };
  }

  async function adminPut(url: string, payload: unknown): Promise<void> {
    const response = await app.inject({
      method: "PUT",
      url,
      headers: { host: TENANT_HOST },
      payload: payload as Record<string, unknown>,
    });
    expect(response.statusCode).toBe(204);
  }

  async function adminGet<T>(url: string): Promise<ListBody<T>> {
    const response = await app.inject({ method: "GET", url, headers: { host: TENANT_HOST } });
    expect(response.statusCode).toBe(200);
    return response.json<ListBody<T>>();
  }

  beforeAll(async () => {
    store = new InMemoryStore();
    const events = new InMemoryEventSink();
    app = buildApp({
      platformBaseDomain: BASE_DOMAIN,
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      locations: new LocationService(store, events),
      resourceHub: new ResourceHubService(store, events),
      availability: new AvailabilityService(store, store),
      tenantTimezone: async (tenantId) =>
        (await store.findTenantById(tenantId))?.defaultTimezone ?? "UTC",
    });

    const tenant = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      payload: { slug: "clinic", displayName: "Clinic", defaultTimezone: "Europe/Madrid" },
    });
    expect(tenant.statusCode).toBe(201);

    const location = await adminPost("/v1/admin/locations", {
      name: "Downtown",
      timezone: "Europe/Madrid",
      address: "Main St 1",
    });
    locationId = location.id;

    const category = await adminPost("/v1/admin/categories", { name: "Health" });
    const service = await adminPost("/v1/admin/services", {
      categoryId: category.id,
      name: "Consultation",
      durationMinutes: 30,
      priceAmount: 4000,
      currency: "EUR",
    });
    serviceId = service.id;
    const provider = await adminPost("/v1/admin/providers", {
      email: "ana@clinic.test",
      displayName: "Ana",
      timezone: "Europe/Madrid",
    });
    providerId = provider.id;
    await adminPost(`/v1/admin/services/${serviceId}/providers`, { providerId });

    await adminPut(`/v1/admin/providers/${providerId}/locations`, { locationIds: [locationId] });

    const resource = await adminPost("/v1/admin/resources", { name: "Room A", quantity: 2 });
    resourceId = resource.id;
    await adminPut(`/v1/admin/resources/${resourceId}/services`, { serviceIds: [serviceId] });
    await adminPut(`/v1/admin/resources/${resourceId}/employees`, { providerIds: [providerId] });
    await adminPut(`/v1/admin/resources/${resourceId}/locations`, { locationIds: [locationId] });
  });

  it("lists, creates, and toggles locations", async () => {
    const body = await adminGet<{ id: string; name: string; status: string }>(
      "/v1/admin/locations",
    );
    const downtown = body.items.find((l) => l.id === locationId);
    expect(downtown?.name).toBe("Downtown");
    expect(downtown?.status).toBe("active");

    const toggled = await app.inject({
      method: "PATCH",
      url: `/v1/admin/locations/${locationId}`,
      headers: { host: TENANT_HOST },
      payload: { active: false },
    });
    expect(toggled.statusCode).toBe(200);
    expect(toggled.json<{ status: string }>().status).toBe("inactive");

    // Restore for downstream assertions that read the location.
    await app.inject({
      method: "PATCH",
      url: `/v1/admin/locations/${locationId}`,
      headers: { host: TENANT_HOST },
      payload: { active: true },
    });
  });

  it("lists categories for the tenant", async () => {
    const body = await adminGet<{ id: string; name: string }>("/v1/admin/categories");
    expect(body.items.map((c) => c.name)).toContain("Health");
  });

  it("lists services for the tenant", async () => {
    const body = await adminGet<{ id: string; name: string }>("/v1/admin/services");
    expect(body.items.map((s) => s.name)).toEqual(["Consultation"]);
  });

  it("lists providers enriched with service assignments and locations", async () => {
    const body = await adminGet<{
      id: string;
      displayName: string;
      serviceIds: string[];
      locationIds: string[];
    }>("/v1/admin/providers");
    const ana = body.items.find((p) => p.id === providerId);
    expect(ana?.displayName).toBe("Ana");
    expect(ana?.serviceIds).toEqual([serviceId]);
    expect(ana?.locationIds).toEqual([locationId]);
  });

  it("lists resources enriched with their hub associations", async () => {
    const body = await adminGet<{
      id: string;
      name: string;
      quantity: number;
      serviceIds: string[];
      locationIds: string[];
      employeeIds: string[];
    }>("/v1/admin/resources");
    const room = body.items.find((r) => r.id === resourceId);
    expect(room?.name).toBe("Room A");
    expect(room?.quantity).toBe(2);
    expect(room?.serviceIds).toEqual([serviceId]);
    expect(room?.employeeIds).toEqual([providerId]);
    expect(room?.locationIds).toEqual([locationId]);
  });

  it("scopes reads to the requesting tenant (unknown host rejected)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/services",
      headers: { host: "intruder.reservas.test" },
    });
    expect(response.statusCode).toBe(404);
  });
});
