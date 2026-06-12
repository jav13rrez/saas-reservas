/**
 * T043: GDPR anonymization preserves non-identifying booking/payment metrics
 * (spec US3 scenario 3) — profile PII is erased, history and amounts survive,
 * the action is audited without leaking erased data, and it is idempotent.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";
import type { Customer } from "@saas-reservas/domain/bookings/booking";
import { FakePaymentGateway } from "@saas-reservas/integrations/payments/payment-gateway";
import { BookingService } from "@saas-reservas/api/application/bookings/booking-service";
import { CartReconciliationService } from "@saas-reservas/api/application/payments/cart-reconciliation-service";
import { GdprAnonymizationService } from "@saas-reservas/api/application/privacy/gdpr-anonymization-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { InMemoryPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-payment-store";

const TENANT = "00000000-0000-4000-8000-000000000001";
const actor = SYSTEM_ACTOR;

const customer: Customer = {
  id: "00000000-0000-4000-8000-00000000c001",
  tenantId: TENANT,
  email: "eva.perez@example.test",
  firstName: "Eva",
  lastName: "Pérez",
  phone: "+34600000001",
  gdprStatus: "active",
};

describe("GDPR anonymization", () => {
  let store: InMemoryPaymentStore;
  let events: InMemoryEventSink;
  let gdpr: GdprAnonymizationService;
  let bookingId: string;

  beforeEach(async () => {
    store = new InMemoryPaymentStore();
    events = new InMemoryEventSink();
    gdpr = new GdprAnonymizationService(store, events);
    await store.insertCustomer({ ...customer });

    // Paid, approved historical booking for this customer.
    const bookings = new BookingService(store, events);
    const reconciliation = new CartReconciliationService(store, new FakePaymentGateway(), events);
    const booking = await bookings.createPendingBooking({
      tenantId: TENANT,
      customerId: customer.id,
      serviceId: "svc-1",
      providerId: "prov-1",
      startAt: "2026-05-01T10:00:00.000Z",
      endAt: "2026-05-01T11:00:00.000Z",
      durationMinutes: 60,
      attendees: 2,
      extras: [],
      totalAmount: 8000,
      currency: "EUR",
      source: "widget",
      service: {
        id: "svc-1",
        tenantId: TENANT,
        categoryId: "cat-1",
        name: "Session",
        durationMinutes: 60,
        priceAmount: 4000,
        currency: "EUR",
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        minCapacity: 1,
        maxCapacity: 4,
        status: "active",
      },
      actor,
    });
    bookingId = booking.id;
    const { cart } = await reconciliation.createCart({
      tenantId: TENANT,
      customerId: customer.id,
      currency: "EUR",
      allocations: [{ bookingId, amount: 8000 }],
      actor,
    });
    await reconciliation.chargeCart({ tenantId: TENANT, cartId: cart.id, actor });
    await bookings.approve(TENANT, bookingId, actor);
  });

  it("erases profile PII while preserving booking and payment metrics", async () => {
    const anonymized = await gdpr.anonymize({ tenantId: TENANT, customerId: customer.id, actor });

    expect(anonymized.gdprStatus).toBe("anonymized");
    expect(anonymized.email).not.toContain("eva");
    expect(anonymized.email).toMatch(/@example\.invalid$/);
    expect(anonymized.firstName).toBe("Anonymized");
    expect(anonymized.phone).toBeUndefined();

    // Non-identifying operational records survive intact.
    const booking = await store.findBookingById(TENANT, bookingId);
    expect(booking?.status).toBe("approved");
    expect(booking?.totalAmount).toBe(8000);
    expect(booking?.attendees).toBe(2);
    expect(booking?.customerId).toBe(customer.id); // linkage by opaque id only
    const subPayment = await store.findSubPaymentByBookingId(TENANT, bookingId);
    expect(subPayment?.amount).toBe(8000);
  });

  it("audits the anonymization without leaking erased data", async () => {
    await gdpr.anonymize({ tenantId: TENANT, customerId: customer.id, actor });

    const audit = events.audits.find((a) => a.action === "privacy.customer-anonymized");
    expect(audit).toBeDefined();
    expect(audit?.entityId).toBe(customer.id);
    const serialized = JSON.stringify([events.audits, events.events]);
    expect(serialized).not.toContain("eva.perez@example.test");
    expect(serialized).not.toContain("+34600000001");
  });

  it("is idempotent: a second request changes nothing and emits no new event", async () => {
    await gdpr.anonymize({ tenantId: TENANT, customerId: customer.id, actor });
    const eventsAfterFirst = events.events.length;

    const second = await gdpr.anonymize({ tenantId: TENANT, customerId: customer.id, actor });
    expect(second.gdprStatus).toBe("anonymized");
    expect(events.events).toHaveLength(eventsAfterFirst);
  });

  it("rejects unknown customers and other tenants' customers", async () => {
    await expect(
      gdpr.anonymize({ tenantId: TENANT, customerId: "missing", actor }),
    ).rejects.toThrow(/not found/);
    await expect(
      gdpr.anonymize({
        tenantId: "00000000-0000-4000-8000-000000000002",
        customerId: customer.id,
        actor,
      }),
    ).rejects.toThrow(/not found/);
  });
});
