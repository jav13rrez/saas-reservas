/**
 * Admin "book on behalf" without charge (ADR-0018 Phase 3): a staff member
 * creates a confirmed booking through /v1/admin/bookings; it is validated
 * against the availability engine, records occupancy (the slot disappears),
 * appears in the admin list, and cancelling it frees the slot again. No cart,
 * gateway, or webhook is involved.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { AdminBookingService } from "@saas-reservas/api/application/bookings/admin-booking-service";
import { BookingService } from "@saas-reservas/api/application/bookings/booking-service";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import { InMemoryPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-payment-store";

const BASE_DOMAIN = "reservas.test";
const TENANT_HOST = "clinic.reservas.test";
const DATE = "2026-06-15"; // Monday

interface Created {
  id: string;
}

interface Slot {
  startAt: string;
}

describe("admin no-charge bookings", () => {
  let app: FastifyInstance;
  let serviceId: string;
  let providerId: string;
  const customerId = "00000000-0000-4000-8000-0000000000c0";

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

  async function slots(): Promise<string[]> {
    const response = await app.inject({
      method: "GET",
      url: `/v1/public/availability?serviceId=${serviceId}&date=${DATE}&providerId=${providerId}`,
      headers: { host: TENANT_HOST },
    });
    expect(response.statusCode).toBe(200);
    return response.json<{ slots: Slot[] }>().slots.map((slot) => slot.startAt);
  }

  beforeAll(async () => {
    const store = new InMemoryStore();
    const paymentStore = new InMemoryPaymentStore();
    const events = new InMemoryEventSink();
    const tenantTimezone = async (id: string): Promise<string> =>
      (await store.findTenantById(id))?.defaultTimezone ?? "UTC";
    const availability = new AvailabilityService(store, store);
    const bookings = new BookingService(paymentStore, events);

    app = buildApp({
      platformBaseDomain: BASE_DOMAIN,
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      availability,
      adminBookings: new AdminBookingService({
        availability,
        catalog: store,
        hub: store,
        bookings,
        reads: paymentStore,
        occupancy: store,
        tenantTimezone,
      }),
      tenantTimezone,
    });

    const tenant = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      payload: { slug: "clinic", displayName: "Clinic", defaultTimezone: "Europe/Madrid" },
    });
    expect(tenant.statusCode).toBe(201);

    const category = await adminPost("/v1/admin/categories", { name: "Health" });
    const service = await adminPost("/v1/admin/services", {
      categoryId: category.id,
      name: "Consultation",
      durationMinutes: 60,
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
    await app.inject({
      method: "PUT",
      url: `/v1/admin/providers/${providerId}/schedule`,
      headers: { host: TENANT_HOST },
      // Monday 10:00-12:00 Madrid = 08:00-10:00 UTC.
      payload: {
        entries: [{ kind: "weekly", weekday: 1, startTime: "10:00", endTime: "12:00", breaks: [] }],
      },
    });
  });

  it("creates a confirmed booking that occupies the slot, lists it, and cancels it", async () => {
    const before = await slots();
    expect(before.length).toBeGreaterThan(0);
    const target = before[0];

    const created = await app.inject({
      method: "POST",
      url: "/v1/admin/bookings",
      headers: { host: TENANT_HOST },
      payload: { serviceId, providerId, customerId, startAt: target, date: DATE },
    });
    expect(created.statusCode).toBe(201);
    const booking = created.json<{ id: string; status: string; source: string }>();
    expect(booking.status).toBe("approved");
    expect(booking.source).toBe("admin");

    // The slot is gone from availability.
    const after = await slots();
    expect(after).not.toContain(target);
    expect(after.length).toBe(before.length - 1);

    // It appears in the admin booking list.
    const list = await app.inject({
      method: "GET",
      url: "/v1/admin/bookings",
      headers: { host: TENANT_HOST },
    });
    expect(list.statusCode).toBe(200);
    const items = list.json<{ items: { id: string; status: string }[] }>().items;
    expect(items.find((b) => b.id === booking.id)?.status).toBe("approved");

    // Cancelling frees the slot.
    const canceled = await app.inject({
      method: "POST",
      url: `/v1/admin/bookings/${booking.id}/cancel`,
      headers: { host: TENANT_HOST },
    });
    expect(canceled.statusCode).toBe(200);
    expect(canceled.json<{ status: string }>().status).toBe("canceled");

    const restored = await slots();
    expect(restored).toContain(target);
    expect(restored.length).toBe(before.length);
  });

  it("rejects a slot that is not currently offered", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/bookings",
      headers: { host: TENANT_HOST },
      payload: {
        serviceId,
        providerId,
        customerId,
        startAt: "2026-06-15T05:00:00.000Z", // before the schedule window
        date: DATE,
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe("slot-not-available");
  });
});
