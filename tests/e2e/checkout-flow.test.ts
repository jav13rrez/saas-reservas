/**
 * Checkout flow over HTTP (US2 scenarios 1 and 3): slot validation, lock
 * acquisition, pending booking + cart charge, idempotent webhook approval,
 * declined payment rejection with lock release, and occupancy after approval.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { BookingService } from "@saas-reservas/api/application/bookings/booking-service";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { CartReconciliationService } from "@saas-reservas/api/application/payments/cart-reconciliation-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { CheckoutLockService } from "@saas-reservas/api/application/scheduling/checkout-lock-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryLockStore } from "@saas-reservas/api/infrastructure/memory/in-memory-lock-store";
import { InMemoryPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-payment-store";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import {
  InMemoryProcessedWebhookStore,
  WebhookProcessor,
} from "@saas-reservas/api/infrastructure/payments/payment-webhooks";
import { FakePaymentGateway } from "@saas-reservas/integrations/payments/payment-gateway";

const HOST = "spa.reservas.test";
const DATE = "2026-06-15"; // Monday
const SLOT = "2026-06-15T08:00:00.000Z"; // 10:00 Madrid

describe("checkout flow", () => {
  let app: FastifyInstance;
  let store: InMemoryStore;
  let paymentStore: InMemoryPaymentStore;
  let gateway: FakePaymentGateway;
  let events: InMemoryEventSink;
  let serviceId: string;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed at call sites
  async function post<T>(url: string, payload: unknown): Promise<{ status: number; body: T }> {
    const response = await app.inject({
      method: "POST",
      url,
      headers: { host: HOST },
      payload: payload as Record<string, unknown>,
    });
    return {
      status: response.statusCode,
      body: response.body.length > 0 ? response.json<T>() : ({} as T),
    };
  }

  async function checkout(startAt = SLOT): Promise<{
    status: number;
    body: { bookingId: string; cartId: string; status: string; error?: string };
  }> {
    return post("/v1/public/checkout", {
      serviceId,
      date: DATE,
      startAt,
      attendees: 1,
      customer: { email: "eva@example.test", firstName: "Eva", lastName: "P" },
    });
  }

  beforeAll(async () => {
    store = new InMemoryStore();
    paymentStore = new InMemoryPaymentStore();
    gateway = new FakePaymentGateway();
    events = new InMemoryEventSink();
    const bookings = new BookingService(paymentStore, events);
    const carts = new CartReconciliationService(paymentStore, gateway, events);
    app = buildApp({
      platformBaseDomain: "reservas.test",
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      availability: new AvailabilityService(store, store),
      tenantTimezone: async (tenantId) =>
        (await store.findTenantById(tenantId))?.defaultTimezone ?? "UTC",
      checkout: {
        catalog: store,
        hub: store,
        locks: new CheckoutLockService(new InMemoryLockStore()),
        bookings,
        carts,
        webhooks: new WebhookProcessor(new InMemoryProcessedWebhookStore(), events),
        occupancy: store,
      },
    });

    await post("/v1/platform/tenants", {
      slug: "spa",
      displayName: "Spa",
      defaultTimezone: "Europe/Madrid",
    });
    const category = await post<{ id: string }>("/v1/admin/categories", { name: "Spa" });
    const service = await post<{ id: string }>("/v1/admin/services", {
      categoryId: category.body.id,
      name: "Massage",
      durationMinutes: 60,
      priceAmount: 5000,
      currency: "EUR",
    });
    serviceId = service.body.id;
    const provider = await post<{ id: string }>("/v1/admin/providers", {
      email: "ana@spa.test",
      displayName: "Ana",
      timezone: "Europe/Madrid",
    });
    await post(`/v1/admin/services/${serviceId}/providers`, { providerId: provider.body.id });
    await app.inject({
      method: "PUT",
      url: `/v1/admin/providers/${provider.body.id}/schedule`,
      headers: { host: HOST },
      payload: {
        entries: [{ kind: "weekly", weekday: 1, startTime: "10:00", endTime: "14:00", breaks: [] }],
      },
    });
  });

  it("creates a pending booking, blocks the slot for competitors, and approves via webhook", async () => {
    const first = await checkout();
    expect(first.status).toBe(201);
    expect(first.body.status).toBe("pending");
    expect(gateway.charges).toHaveLength(1);
    expect(gateway.charges[0]?.request.amount).toBe(5000);

    // A competing checkout for the same slot is rejected while the lock holds.
    const competitor = await checkout();
    expect(competitor.status).toBe(409);

    // Gateway webhook approves the booking; a duplicate delivery is a no-op.
    const webhook = {
      id: "evt_ok_1",
      type: "charge.succeeded",
      payload: { cartId: first.body.cartId },
    };
    const settled = await post<{ outcome: string }>("/v1/public/payments/webhook", webhook);
    expect(settled.body.outcome).toBe("processed");
    const duplicate = await post<{ outcome: string }>("/v1/public/payments/webhook", webhook);
    expect(duplicate.body.outcome).toBe("duplicate");

    const booking = await paymentStore.findBookingById(
      gateway.charges[0]?.request.tenantId ?? "",
      first.body.bookingId,
    );
    expect(booking?.status).toBe("approved");
    expect(events.audits.map((audit) => audit.action)).toContain("booking.approved");

    // The approved slot is now real occupancy: it disappears from availability.
    const availability = await app.inject({
      method: "GET",
      url: `/v1/public/availability?serviceId=${serviceId}&date=${DATE}`,
      headers: { host: HOST },
    });
    const slots = availability.json<{ slots: { startAt: string }[] }>().slots;
    expect(slots.map((slot) => slot.startAt)).not.toContain(SLOT);
  });

  it("rejects the booking and frees the slot when the charge is declined", async () => {
    const laterSlot = "2026-06-15T09:00:00.000Z"; // 11:00 Madrid, untouched by test 1
    gateway.failNextChargeWith = "declined";
    const declined = await checkout(laterSlot);
    expect(declined.status).toBe(402);
    expect(declined.body.error).toBe("payment-declined");

    const booking = await paymentStore.findBookingById(
      gateway.charges[0]?.request.tenantId ?? "",
      declined.body.bookingId,
    );
    expect(booking?.status).toBe("rejected");
    expect(events.audits.map((audit) => audit.action)).toContain("payment.charge-failed");

    // Lock was released: the same slot can be checked out again immediately.
    const retry = await checkout(laterSlot);
    expect(retry.status).toBe(201);
  });

  it("rejects checkouts for slots the availability engine does not offer", async () => {
    const offSchedule = await post("/v1/public/checkout", {
      serviceId,
      date: DATE,
      startAt: "2026-06-15T20:00:00.000Z",
      customer: { email: "eva@example.test", firstName: "Eva", lastName: "P" },
    });
    expect(offSchedule.status).toBe(409);
  });
});
