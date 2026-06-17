/**
 * T018: single-provider widget behavior over the HTTP API (spec US1 scenario 2),
 * plus availability respecting configured rules (scenario 1) end to end:
 * tenant setup -> catalog -> provider schedule -> public widget/availability.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";

const BASE_DOMAIN = "reservas.test";
const TENANT_HOST = "clinic.reservas.test";

interface Created {
  id: string;
}

interface AvailabilityBody {
  providerId: string;
  providerSelection: string;
  slots: { startAt: string; endAt: string }[];
}

describe("booking widget, single-provider tenant", () => {
  let app: FastifyInstance;
  let store: InMemoryStore;
  let events: InMemoryEventSink;
  let serviceId: string;
  let providerId: string;

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

  beforeAll(async () => {
    store = new InMemoryStore();
    events = new InMemoryEventSink();
    app = buildApp({
      platformBaseDomain: BASE_DOMAIN,
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      availability: new AvailabilityService(store, store),
      tenantTimezone: async (tenantId) =>
        (await store.findTenantById(tenantId))?.defaultTimezone ?? "UTC",
    });

    const tenantResponse = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      payload: { slug: "clinic", displayName: "Clinic", defaultTimezone: "Europe/Madrid" },
    });
    expect(tenantResponse.statusCode).toBe(201);

    const category = await adminPost("/v1/admin/categories", { name: "Health" });
    const service = await adminPost("/v1/admin/services", {
      categoryId: category.id,
      name: "Consultation",
      durationMinutes: 30,
      priceAmount: 40,
      currency: "EUR",
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
    });
    serviceId = service.id;
    const provider = await adminPost("/v1/admin/providers", {
      email: "ana@clinic.test",
      displayName: "Ana",
      timezone: "Europe/Madrid",
    });
    providerId = provider.id;
    await adminPost(`/v1/admin/services/${serviceId}/providers`, { providerId });
    const scheduleResponse = await app.inject({
      method: "PUT",
      url: `/v1/admin/providers/${providerId}/schedule`,
      headers: { host: TENANT_HOST },
      // 2026-06-15 is a Monday; 10:00-12:00 Madrid = 08:00-10:00 UTC.
      payload: {
        entries: [{ kind: "weekly", weekday: 1, startTime: "10:00", endTime: "12:00", breaks: [] }],
      },
    });
    expect(scheduleResponse.statusCode).toBe(204);
  });

  it("omits provider selection when the service has exactly one active provider", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/public/widget-config?serviceId=${serviceId}`,
      headers: { host: TENANT_HOST },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      providerSelection: "hidden",
      providers: [{ displayName: "Ana" }],
    });
  });

  it("auto-assigns the single provider and exposes slots only within configured rules", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/public/availability?serviceId=${serviceId}&date=2026-06-15`,
      headers: { host: TENANT_HOST },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<AvailabilityBody>();
    expect(body.providerId).toBe(providerId);
    expect(body.providerSelection).toBe("auto");
    // 30 min service + 15 min buffer after = 45 min occupancy; window 08:00-10:00 UTC,
    // candidates step by appointment duration (30 min): 10:00, 10:30, 11:00 local fit
    // (occupancy ends 11:45 <= 12:00); 11:30 does not (ends 12:15).
    expect(body.slots.map((slot) => slot.startAt)).toEqual([
      "2026-06-15T08:00:00.000Z",
      "2026-06-15T08:30:00.000Z",
      "2026-06-15T09:00:00.000Z",
    ]);
    // No slots on a day without schedule.
    const tuesday = await app.inject({
      method: "GET",
      url: `/v1/public/availability?serviceId=${serviceId}&date=2026-06-16`,
      headers: { host: TENANT_HOST },
    });
    expect(tuesday.json<AvailabilityBody>().slots).toEqual([]);
  });

  it("requires provider selection once a second active provider is assigned", async () => {
    const second = await adminPost("/v1/admin/providers", {
      email: "luis@clinic.test",
      displayName: "Luis",
      timezone: "Europe/Madrid",
    });
    await adminPost(`/v1/admin/services/${serviceId}/providers`, { providerId: second.id });

    const config = await app.inject({
      method: "GET",
      url: `/v1/public/widget-config?serviceId=${serviceId}`,
      headers: { host: TENANT_HOST },
    });
    expect(config.json<{ providerSelection: string }>().providerSelection).toBe("required");

    const availability = await app.inject({
      method: "GET",
      url: `/v1/public/availability?serviceId=${serviceId}&date=2026-06-15`,
      headers: { host: TENANT_HOST },
    });
    expect(availability.statusCode).toBe(400);
    expect(availability.json<{ error: string }>().error).toBe("provider-required");
  });

  it("rejects unknown hosts and records audit events for setup actions", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/public/widget-config?serviceId=${serviceId}`,
      headers: { host: "other.reservas.test" },
    });
    expect(response.statusCode).toBe(404);

    const actions = events.audits.map((audit) => audit.action);
    expect(actions).toContain("tenant.created");
    expect(actions).toContain("catalog.service-created");
    expect(actions).toContain("catalog.provider-schedule-updated");
  });
});
