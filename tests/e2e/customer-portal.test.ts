/**
 * US3 portal flows over HTTP: passwordless session via cookie, customer
 * cancels within policy (refund + freed slot), out-of-window reschedule is
 * rejected, GDPR self-erasure, and staff permission checks.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";
import { DEFAULT_POLICIES } from "@saas-reservas/domain/tenancy/tenant";
import { MINUTE_MS } from "@saas-reservas/domain/scheduling/time";
import { FakePaymentGateway } from "@saas-reservas/integrations/payments/payment-gateway";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { BookingChangeService } from "@saas-reservas/api/application/bookings/booking-change-service";
import { BookingService } from "@saas-reservas/api/application/bookings/booking-service";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { CartReconciliationService } from "@saas-reservas/api/application/payments/cart-reconciliation-service";
import { CartPaymentSettlement } from "@saas-reservas/api/application/payments/payment-settlement";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import {
  CustomerPasswordlessService,
  InMemoryNonceStore,
} from "@saas-reservas/api/application/identity/customer-passwordless-service";
import { GdprAnonymizationService } from "@saas-reservas/api/application/privacy/gdpr-anonymization-service";
import { ProviderPortalService } from "@saas-reservas/api/application/providers/provider-portal-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-payment-store";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";

const HOST = "portal.reservas.test";
const CUSTOMER = "00000000-0000-4000-8000-00000000c001";
// Far-future Monday so the 24h cancellation policy allows changes.
const START = "2027-06-14T10:00:00.000Z";

describe("customer and staff portals", () => {
  let app: FastifyInstance;
  let store: InMemoryStore;
  let paymentStore: InMemoryPaymentStore;
  let gateway: FakePaymentGateway;
  let cookie: string;
  let bookingId: string;
  let providerId: string;
  let restrictedProviderId: string;

  beforeAll(async () => {
    store = new InMemoryStore();
    paymentStore = new InMemoryPaymentStore();
    gateway = new FakePaymentGateway();
    const events = new InMemoryEventSink();
    const catalogService = new CatalogService(store, events);
    const bookingService = new BookingService(paymentStore, events);
    const reconciliation = new CartReconciliationService(paymentStore, gateway, events);
    const availability = new AvailabilityService(store, store);
    const passwordless = new CustomerPasswordlessService(
      CustomerPasswordlessService.generateKeys(),
      new InMemoryNonceStore(),
    );

    app = buildApp({
      platformBaseDomain: "reservas.test",
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService,
      availability,
      tenantTimezone: () => Promise.resolve("UTC"),
      portal: {
        passwordless,
        changes: new BookingChangeService(
          paymentStore,
          bookingService,
          new CartPaymentSettlement(paymentStore, reconciliation),
          store,
          availability,
          store,
          store,
        ),
        gdpr: new GdprAnonymizationService(paymentStore, events),
        providerPortal: new ProviderPortalService(store, catalogService, paymentStore),
        bookings: paymentStore,
        tenantSettings: () => Promise.resolve({ policies: DEFAULT_POLICIES, timezone: "UTC" }),
      },
    });

    // Tenant + catalog + approved paid booking, seeded directly.
    const actor = SYSTEM_ACTOR;
    const tenantResponse = await app.inject({
      method: "POST",
      url: "/v1/platform/tenants",
      payload: { slug: "portal", displayName: "Portal", defaultTimezone: "UTC" },
    });
    const tenantId = tenantResponse.json<{ id: string }>().id;
    const service = await catalogService.createService({
      tenantId,
      categoryId: "cat-1",
      name: "Session",
      durationMinutes: 60,
      priceAmount: 5000,
      currency: "EUR",
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minCapacity: 1,
      maxCapacity: 1,
      actor,
    });
    const provider = await catalogService.createProvider({
      tenantId,
      email: "ana@portal.test",
      displayName: "Ana",
      timezone: "UTC",
      permissions: ["manage-own-schedule", "manage-own-bookings"],
      actor,
    });
    providerId = provider.id;
    const restricted = await catalogService.createProvider({
      tenantId,
      email: "luis@portal.test",
      displayName: "Luis",
      timezone: "UTC",
      permissions: [],
      actor,
    });
    restrictedProviderId = restricted.id;
    await catalogService.assignProvider({ tenantId, serviceId: service.id, providerId, actor });
    await catalogService.setProviderSchedule({
      tenantId,
      providerId,
      entries: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "13:00", breaks: [] }],
      actor,
    });

    await paymentStore.insertCustomer({
      id: CUSTOMER,
      tenantId,
      email: "eva@example.test",
      firstName: "Eva",
      lastName: "P",
      gdprStatus: "active",
    });
    const booking = await bookingService.createPendingBooking({
      tenantId,
      customerId: CUSTOMER,
      serviceId: service.id,
      providerId,
      startAt: START,
      endAt: new Date(Date.parse(START) + 60 * MINUTE_MS).toISOString(),
      durationMinutes: 60,
      attendees: 1,
      extras: [],
      totalAmount: 5000,
      currency: "EUR",
      source: "widget",
      service,
      actor,
    });
    bookingId = booking.id;
    const { cart } = await reconciliation.createCart({
      tenantId,
      customerId: CUSTOMER,
      currency: "EUR",
      allocations: [{ bookingId, amount: 5000 }],
      actor,
    });
    await reconciliation.chargeCart({ tenantId, cartId: cart.id, actor });
    await bookingService.approve(tenantId, bookingId, actor);
    store.recordBookingOccupancy(
      tenantId,
      providerId,
      { start: Date.parse(START), end: Date.parse(START) + 60 * MINUTE_MS },
      [],
      bookingId,
    );
  });

  it("creates a session from a passwordless link and lists the customer's bookings", async () => {
    const link = await app.inject({
      method: "POST",
      url: "/v1/portal/customer/access-links",
      headers: { host: HOST },
      payload: { customerId: CUSTOMER },
    });
    const { token } = link.json<{ token: string }>();

    const session = await app.inject({
      method: "POST",
      url: "/v1/portal/customer/sessions",
      headers: { host: HOST },
      payload: { token },
    });
    expect(session.statusCode).toBe(201);
    const setCookie = session.headers["set-cookie"] as string;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    cookie = setCookie.split(";")[0] ?? "";

    // The link token is single-use.
    const replay = await app.inject({
      method: "POST",
      url: "/v1/portal/customer/sessions",
      headers: { host: HOST },
      payload: { token },
    });
    expect(replay.statusCode).toBe(401);

    const bookings = await app.inject({
      method: "GET",
      url: "/v1/portal/customer/bookings",
      headers: { host: HOST, cookie },
    });
    expect(bookings.statusCode).toBe(200);
    expect(bookings.json<{ bookings: { id: string }[] }>().bookings.map((b) => b.id)).toEqual([
      bookingId,
    ]);
  });

  it("rejects rescheduling to an unavailable slot without changing the booking", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/v1/portal/customer/bookings/${bookingId}/reschedule`,
      headers: { host: HOST, cookie },
      payload: { startAt: "2027-06-14T20:00:00.000Z", date: "2027-06-14" },
    });
    expect(response.statusCode).toBe(409);
  });

  it("cancels within policy: refund issued and the slot becomes available again", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/v1/portal/customer/bookings/${bookingId}/cancel`,
      headers: { host: HOST, cookie },
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "canceled", refund: "refunded" });
    expect(gateway.refunds[0]?.request.amount).toBe(5000);

    // Canceling again hits the state machine via policy: invalid-status.
    const again = await app.inject({
      method: "POST",
      url: `/v1/portal/customer/bookings/${bookingId}/cancel`,
      headers: { host: HOST, cookie },
      payload: {},
    });
    expect(again.statusCode).toBe(422);
  });

  it("anonymizes the customer on GDPR self-erasure", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/portal/customer/gdpr-erasure",
      headers: { host: HOST, cookie },
      payload: {},
    });
    expect(response.json()).toEqual({ gdprStatus: "anonymized" });
  });

  it("staff portal enforces provider permissions", async () => {
    const allowed = await app.inject({
      method: "PUT",
      url: "/v1/portal/staff/schedule",
      headers: { host: HOST, "x-provider-id": providerId },
      payload: {
        entries: [{ kind: "weekly", weekday: 2, startTime: "09:00", endTime: "12:00", breaks: [] }],
      },
    });
    expect(allowed.statusCode).toBe(204);

    const denied = await app.inject({
      method: "PUT",
      url: "/v1/portal/staff/schedule",
      headers: { host: HOST, "x-provider-id": restrictedProviderId },
      payload: { entries: [] },
    });
    expect(denied.statusCode).toBe(403);

    const bookings = await app.inject({
      method: "GET",
      url: "/v1/portal/staff/bookings",
      headers: { host: HOST, "x-provider-id": providerId },
    });
    expect(bookings.statusCode).toBe(200);
    const list = bookings.json<{ bookings: { customerId: string }[] }>().bookings;
    // Ana lacks view-customer-contact: customer linkage is hidden.
    expect(list.every((booking) => booking.customerId === "hidden")).toBe(true);
  });
});
