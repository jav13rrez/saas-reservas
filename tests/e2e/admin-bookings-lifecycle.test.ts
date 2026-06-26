/**
 * Booking lifecycle + configurable default status + manual payments
 * (feature 004) over HTTP.
 *
 * US1: complete/no-show terminal transitions; invalid transition -> 409.
 * US2: requiresApproval=true creates Pending; approve -> Approved; reject -> slot freed.
 * US3: PUT/GET manual payment; invalid amount -> 400.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { AdminBookingService } from "@saas-reservas/api/application/bookings/admin-booking-service";
import { BookingService } from "@saas-reservas/api/application/bookings/booking-service";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { ManualPaymentService } from "@saas-reservas/api/application/payments/manual-payment-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import { InMemoryPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-payment-store";
import { InMemoryManualPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-manual-payment-store";

const BASE_DOMAIN = "reservas.test";
const HOST = "clinic.reservas.test";
const DATE = "2026-06-15"; // Monday
const customerId = "00000000-0000-4000-8000-0000000000c0";

describe("booking lifecycle + default status + manual payments", () => {
  let app: FastifyInstance;
  let serviceId: string;
  let providerId: string;

  async function adminPost(url: string, payload: unknown): Promise<{ id: string }> {
    const r = await app.inject({
      method: "POST",
      url,
      headers: { host: HOST },
      payload: payload as Record<string, unknown>,
    });
    expect([201, 204]).toContain(r.statusCode);
    return r.statusCode === 201 ? r.json<{ id: string }>() : { id: "" };
  }

  async function slots(): Promise<string[]> {
    const r = await app.inject({
      method: "GET",
      url: `/v1/public/availability?serviceId=${serviceId}&date=${DATE}&providerId=${providerId}`,
      headers: { host: HOST },
    });
    return r.json<{ slots: { startAt: string }[] }>().slots.map((s) => s.startAt);
  }

  async function createBooking(startAt: string): Promise<{ id: string; status: string }> {
    const r = await app.inject({
      method: "POST",
      url: "/v1/admin/bookings",
      headers: { host: HOST },
      payload: { serviceId, providerId, customerId, startAt, date: DATE },
    });
    expect(r.statusCode).toBe(201);
    return r.json<{ id: string; status: string }>();
  }

  function action(
    id: string,
    act: string,
  ): Promise<{ statusCode: number; json: () => { status?: string } }> {
    return app
      .inject({ method: "POST", url: `/v1/admin/bookings/${id}/${act}`, headers: { host: HOST } })
      .then((r) => ({ statusCode: r.statusCode, json: () => r.json<{ status?: string }>() }));
  }

  async function setRequiresApproval(value: boolean): Promise<void> {
    const r = await app.inject({
      method: "PATCH",
      url: "/v1/admin/settings",
      headers: { host: HOST },
      payload: { policies: { requiresApproval: value } },
    });
    expect(r.statusCode).toBe(200);
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
        requiresApproval: async (id) =>
          (await store.findTenantById(id))?.policies.requiresApproval ?? false,
      }),
      manualPayments: new ManualPaymentService(new InMemoryManualPaymentStore(), events),
      tenantTimezone,
    });

    await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      payload: { slug: "clinic", displayName: "Clinic", defaultTimezone: "Europe/Madrid" },
    });
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
      headers: { host: HOST },
      payload: {
        // Wide window so each test has fresh slots (completed/no-show do not free occupancy).
        entries: [{ kind: "weekly", weekday: 1, startTime: "10:00", endTime: "18:00", breaks: [] }],
      },
    });
  });

  it("US1: marks an approved booking Completed (terminal) and rejects an invalid transition", async () => {
    const free = await slots();
    const booking = await createBooking(free[0]);
    expect(booking.status).toBe("approved"); // default requiresApproval=false

    const completed = await action(booking.id, "complete");
    expect(completed.statusCode).toBe(200);
    expect(completed.json().status).toBe("completed");

    // Completed is terminal: completing again (or any transition) -> 409.
    const again = await action(booking.id, "complete");
    expect(again.statusCode).toBe(409);
  });

  it("US1: marks an approved booking No-show", async () => {
    const free = await slots();
    const booking = await createBooking(free[0]);
    const noShow = await action(booking.id, "no-show");
    expect(noShow.statusCode).toBe(200);
    expect(noShow.json().status).toBe("no_show");
  });

  it("US2: requiresApproval creates Pending; approve confirms; reject frees the slot", async () => {
    await setRequiresApproval(true);
    const free = await slots();
    const target = free[0];

    const pending = await createBooking(target);
    expect(pending.status).toBe("pending");
    // Slot is held while pending.
    expect(await slots()).not.toContain(target);

    const approved = await action(pending.id, "approve");
    expect(approved.json().status).toBe("approved");

    // A second pending booking on a new slot, then reject -> slot returns.
    const free2 = await slots();
    const target2 = free2[0];
    const pending2 = await createBooking(target2);
    expect(pending2.status).toBe("pending");
    const rejected = await action(pending2.id, "reject");
    expect(rejected.json().status).toBe("rejected");
    expect(await slots()).toContain(target2);

    await setRequiresApproval(false);
  });

  it("US3: records and reads a manual payment; rejects an invalid one", async () => {
    const free = await slots();
    const booking = await createBooking(free[0]);

    const put = await app.inject({
      method: "PUT",
      url: `/v1/admin/bookings/${booking.id}/payment`,
      headers: { host: HOST },
      payload: { method: "cash", status: "partial", amount: 4000, deposit: 1000, currency: "EUR" },
    });
    expect(put.statusCode).toBe(200);

    const get = await app.inject({
      method: "GET",
      url: `/v1/admin/bookings/${booking.id}/payment`,
      headers: { host: HOST },
    });
    const payment = get.json<{ method: string; status: string; deposit: number } | null>();
    expect(payment?.method).toBe("cash");
    expect(payment?.status).toBe("partial");
    expect(payment?.deposit).toBe(1000);

    const bad = await app.inject({
      method: "PUT",
      url: `/v1/admin/bookings/${booking.id}/payment`,
      headers: { host: HOST },
      payload: { method: "cash", status: "paid", amount: 1000, deposit: 5000, currency: "EUR" },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json<{ error: string }>().error).toBe("invalid-deposit");
  });
});
