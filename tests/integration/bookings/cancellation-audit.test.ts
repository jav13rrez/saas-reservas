/**
 * T044: cancellation/refund event emission and audit records (spec US3
 * scenarios 1-2), plus reschedule: out-of-window attempts change nothing,
 * in-window cancel refunds the subpayment and frees occupancy, reschedule to a
 * conflicting slot is rejected, and a valid reschedule swaps occupancy and
 * re-points the payment.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";
import { DEFAULT_POLICIES, type TenantPolicies } from "@saas-reservas/domain/tenancy/tenant";
import { MINUTE_MS } from "@saas-reservas/domain/scheduling/time";
import { FakePaymentGateway } from "@saas-reservas/integrations/payments/payment-gateway";
import {
  BookingChangeService,
  ChangeRejectedError,
} from "@saas-reservas/api/application/bookings/booking-change-service";
import { BookingService } from "@saas-reservas/api/application/bookings/booking-service";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { CartReconciliationService } from "@saas-reservas/api/application/payments/cart-reconciliation-service";
import { CartPaymentSettlement } from "@saas-reservas/api/application/payments/payment-settlement";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { InMemoryPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-payment-store";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";

const TENANT = "00000000-0000-4000-8000-000000000001";
const TZ = "UTC";
const actor = SYSTEM_ACTOR;
// Monday 2026-06-15, schedule 09:00-13:00 UTC; booking at 10:00.
const START = "2026-06-15T10:00:00.000Z";

const policies: TenantPolicies = { ...DEFAULT_POLICIES, cancellationMinNoticeHours: 24 };
const wellBefore = new Date(Date.parse(START) - 48 * 3_600_000);
const tooLate = new Date(Date.parse(START) - 2 * 3_600_000);

describe("booking changes: cancel, refund, reschedule", () => {
  let store: InMemoryStore;
  let paymentStore: InMemoryPaymentStore;
  let events: InMemoryEventSink;
  let gateway: FakePaymentGateway;
  let changes: BookingChangeService;
  let availability: AvailabilityService;
  let serviceId: string;
  let providerId: string;
  let bookingId: string;

  beforeEach(async () => {
    store = new InMemoryStore();
    paymentStore = new InMemoryPaymentStore();
    events = new InMemoryEventSink();
    gateway = new FakePaymentGateway();
    const catalogService = new CatalogService(store, events);
    const bookingService = new BookingService(paymentStore, events);
    const reconciliation = new CartReconciliationService(paymentStore, gateway, events);
    availability = new AvailabilityService(store, store);
    changes = new BookingChangeService(
      paymentStore,
      bookingService,
      new CartPaymentSettlement(paymentStore, reconciliation),
      store,
      availability,
      store,
      store,
    );

    const category = await catalogService.createCategory({
      tenantId: TENANT,
      name: "General",
      sortOrder: 0,
      actor,
    });
    const service = await catalogService.createService({
      tenantId: TENANT,
      categoryId: category.id,
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
    serviceId = service.id;
    const provider = await catalogService.createProvider({
      tenantId: TENANT,
      email: "ana@t.test",
      displayName: "Ana",
      timezone: TZ,
      permissions: [],
      actor,
    });
    providerId = provider.id;
    await catalogService.assignProvider({ tenantId: TENANT, serviceId, providerId, actor });
    await catalogService.setProviderSchedule({
      tenantId: TENANT,
      providerId,
      entries: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "13:00", breaks: [] }],
      actor,
    });

    // Approved + paid booking at 10:00 with recorded occupancy.
    const booking = await bookingService.createPendingBooking({
      tenantId: TENANT,
      customerId: "00000000-0000-4000-8000-00000000c001",
      serviceId,
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
      tenantId: TENANT,
      customerId: booking.customerId,
      currency: "EUR",
      allocations: [{ bookingId, amount: 5000 }],
      actor,
    });
    await reconciliation.chargeCart({ tenantId: TENANT, cartId: cart.id, actor });
    await bookingService.approve(TENANT, bookingId, actor);
    store.recordBookingOccupancy(
      TENANT,
      providerId,
      { start: Date.parse(START), end: Date.parse(START) + 60 * MINUTE_MS },
      [],
      bookingId,
    );
  });

  async function slotsFor(date: string): Promise<string[]> {
    const result = await availability.availability({
      tenantId: TENANT,
      serviceId,
      date,
      tenantTimezone: TZ,
    });
    return result.ok ? result.slots.map((slot) => slot.startAt) : [];
  }

  it("rejects out-of-window cancellation without touching booking, payment, or occupancy", async () => {
    await expect(
      changes.cancel({ tenantId: TENANT, bookingId, policies, actor, now: tooLate }),
    ).rejects.toThrow(ChangeRejectedError);

    expect((await paymentStore.findBookingById(TENANT, bookingId))?.status).toBe("approved");
    expect(gateway.refunds).toHaveLength(0);
    expect(await slotsFor("2026-06-15")).not.toContain(START); // still occupied
    expect(events.audits.map((a) => a.action)).not.toContain("booking.canceled");
  });

  it("cancels in window: refunds the subpayment, frees the slot, and audits everything", async () => {
    const result = await changes.cancel({
      tenantId: TENANT,
      bookingId,
      policies,
      actor,
      now: wellBefore,
    });
    expect(result.booking.status).toBe("canceled");
    expect(result.refund).toBe("refunded");
    expect(gateway.refunds[0]?.request.amount).toBe(5000);

    // The slot is bookable again.
    expect(await slotsFor("2026-06-15")).toContain(START);

    const actions = events.audits.map((a) => a.action);
    expect(actions).toContain("booking.canceled");
    expect(actions).toContain("payment.refunded");
    // Matching domain events were emitted alongside the audits.
    expect(events.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["booking.canceled", "payment.refunded"]),
    );
  });

  it("rejects rescheduling into a conflicting slot", async () => {
    // Occupy 11:00 with another confirmed booking.
    store.recordBookingOccupancy(
      TENANT,
      providerId,
      {
        start: Date.parse("2026-06-15T11:00:00.000Z"),
        end: Date.parse("2026-06-15T12:00:00.000Z"),
      },
      [],
      "other-booking",
    );
    await expect(
      changes.reschedule({
        tenantId: TENANT,
        bookingId,
        newStartAt: "2026-06-15T11:00:00.000Z",
        newDate: "2026-06-15",
        policies,
        tenantTimezone: TZ,
        actor,
        now: wellBefore,
      }),
    ).rejects.toThrow(/slot-not-available/);
    expect((await paymentStore.findBookingById(TENANT, bookingId))?.status).toBe("approved");
  });

  it("reschedules in window: swaps occupancy, re-points the subpayment, audits both bookings", async () => {
    const { oldBooking, newBooking } = await changes.reschedule({
      tenantId: TENANT,
      bookingId,
      newStartAt: "2026-06-15T12:00:00.000Z",
      newDate: "2026-06-15",
      policies,
      tenantTimezone: TZ,
      actor,
      now: wellBefore,
    });
    expect(oldBooking.status).toBe("rescheduled");
    expect(newBooking.status).toBe("approved");
    expect(newBooking.startAt).toBe("2026-06-15T12:00:00.000Z");

    // Old slot freed, new slot occupied.
    const slots = await slotsFor("2026-06-15");
    expect(slots).toContain(START);
    expect(slots).not.toContain("2026-06-15T12:00:00.000Z");

    // The subpayment now follows the replacement booking; refunds keep working.
    const subPayment = await paymentStore.findSubPaymentByBookingId(TENANT, newBooking.id);
    expect(subPayment?.amount).toBe(5000);
    expect(await paymentStore.findSubPaymentByBookingId(TENANT, bookingId)).toBeNull();

    const actions = events.audits.map((a) => a.action);
    expect(actions).toContain("booking.rescheduled");
    expect(actions).toContain("booking.approved");
  });
});
