/**
 * Stripe webhook capture over HTTP. A checkout creates a pending booking + hold;
 * a signed Stripe `payment_intent.succeeded` event (carrying the cart id in
 * PaymentIntent metadata) approves the booking and records occupancy. Invalid
 * signatures are rejected, duplicate events are no-ops, and a payment-failure
 * event rejects the booking and frees the slot.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
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
const SECRET = "whsec_test";

function stripeSignature(rawBody: string, t = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", SECRET)
    .update(`${String(t)}.${rawBody}`)
    .digest("hex");
  return `t=${String(t)},v1=${sig}`;
}

describe("stripe webhook capture", () => {
  let app: FastifyInstance;
  let store: InMemoryStore;
  let paymentStore: InMemoryPaymentStore;
  let events: InMemoryEventSink;
  let serviceId: string;
  let tenantId: string;

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

  function checkout(startAt = SLOT): Promise<{
    status: number;
    body: { bookingId: string; cartId: string };
  }> {
    return post("/v1/public/checkout", {
      serviceId,
      date: DATE,
      startAt,
      attendees: 1,
      customer: { email: "eva@example.test", firstName: "Eva", lastName: "P" },
    });
  }

  /** POST a raw Stripe event body with an optional signature header. */
  function postStripe(
    rawBody: string,
    signature: string | undefined,
  ): Promise<{ status: number; body: { outcome?: string; error?: string } }> {
    const headers: Record<string, string> = { host: HOST, "content-type": "application/json" };
    if (signature !== undefined) headers["stripe-signature"] = signature;
    return app
      .inject({
        method: "POST",
        url: "/v1/public/payments/stripe-webhook",
        headers,
        payload: rawBody,
      })
      .then((response) => ({
        status: response.statusCode,
        body: response.body.length > 0 ? response.json() : {},
      }));
  }

  function stripeEvent(id: string, type: string, cartId: string): string {
    // Tenant + cart ride in the PaymentIntent metadata (set at charge time); the
    // platform webhook resolves the tenant from there, not from the Host.
    return JSON.stringify({
      id,
      type,
      data: { object: { id: "pi_test", metadata: { cartId, tenantId } } },
    });
  }

  beforeAll(async () => {
    store = new InMemoryStore();
    paymentStore = new InMemoryPaymentStore();
    events = new InMemoryEventSink();
    const gateway = new FakePaymentGateway();
    const bookings = new BookingService(paymentStore, events);
    const carts = new CartReconciliationService(paymentStore, gateway, events);
    app = buildApp({
      platformBaseDomain: "reservas.test",
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      availability: new AvailabilityService(store, store),
      tenantTimezone: async (id) => (await store.findTenantById(id))?.defaultTimezone ?? "UTC",
      checkout: {
        catalog: store,
        hub: store,
        locks: new CheckoutLockService(new InMemoryLockStore()),
        bookings,
        carts,
        webhooks: new WebhookProcessor(new InMemoryProcessedWebhookStore(), events),
        occupancy: store,
        stripeWebhookSecret: SECRET,
      },
    });

    const tenant = await post<{ id: string }>("/v1/platform/tenants", {
      slug: "spa",
      displayName: "Spa",
      defaultTimezone: "Europe/Madrid",
    });
    tenantId = tenant.body.id;
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

  it("approves the booking on a signed payment_intent.succeeded and is idempotent", async () => {
    const booked = await checkout();
    expect(booked.status).toBe(201);

    const raw = stripeEvent("evt_pi_succeeded_1", "payment_intent.succeeded", booked.body.cartId);
    const settled = await postStripe(raw, stripeSignature(raw));
    expect(settled.status).toBe(200);
    expect(settled.body.outcome).toBe("processed");

    const booking = await paymentStore.findBookingById(tenantId, booked.body.bookingId);
    expect(booking?.status).toBe("approved");

    // The approved slot becomes real occupancy and leaves availability.
    const availability = await app.inject({
      method: "GET",
      url: `/v1/public/availability?serviceId=${serviceId}&date=${DATE}`,
      headers: { host: HOST },
    });
    expect(
      availability.json<{ slots: { startAt: string }[] }>().slots.map((s) => s.startAt),
    ).not.toContain(SLOT);

    // A duplicate delivery of the same event id is a no-op.
    const duplicate = await postStripe(raw, stripeSignature(raw));
    expect(duplicate.body.outcome).toBe("duplicate");
  });

  it("rejects an invalid signature with 400 and does not settle", async () => {
    const later = "2026-06-15T09:00:00.000Z"; // 11:00 Madrid
    const booked = await checkout(later);
    expect(booked.status).toBe(201);

    const raw = stripeEvent("evt_pi_bad_sig", "payment_intent.succeeded", booked.body.cartId);
    const bad = await postStripe(raw, "t=123,v1=deadbeef");
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("invalid-signature");

    const booking = await paymentStore.findBookingById(tenantId, booked.body.bookingId);
    expect(booking?.status).toBe("pending");
  });

  it("rejects the booking and frees the slot on payment_intent.payment_failed", async () => {
    const slot = "2026-06-15T11:00:00.000Z"; // 13:00 Madrid
    const booked = await checkout(slot);
    expect(booked.status).toBe(201);

    const raw = stripeEvent("evt_pi_failed_1", "payment_intent.payment_failed", booked.body.cartId);
    const failed = await postStripe(raw, stripeSignature(raw));
    expect(failed.body.outcome).toBe("processed");

    const booking = await paymentStore.findBookingById(tenantId, booked.body.bookingId);
    expect(booking?.status).toBe("rejected");

    // Lock freed: the slot can be checked out again.
    const retry = await checkout(slot);
    expect(retry.status).toBe(201);
  });
});
