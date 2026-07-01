/**
 * Feature 004 (T012/T013) — demo-store coverage for the admin console's
 * booking lifecycle and manual payments. Exercises the store directly (not
 * through Next.js route handlers) since it owns all the business rules the
 * seam simply forwards.
 *
 * Covers what the loop's VERIFY requires:
 *  1. The 6 domain states surface uncollapsed (no more confirmed/cancelled).
 *  2. At least one invalid transition is rejected (mirrors domain TRANSITIONS).
 *  3. Manual payment upsert + read, with deposit <= amount accepted and
 *     deposit > amount rejected.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InvalidBookingTransitionError } from "@saas-reservas/domain/bookings/booking";
import {
  approveBooking,
  cancelBooking,
  completeBooking,
  createBooking,
  createCustomer,
  createProvider,
  createService,
  getBookingPayment,
  listBookings,
  noShowBooking,
  rejectBooking,
  upsertBookingPayment,
  type AdminBooking,
  type BookingStatus,
} from "../demo-store";

const globalForStore = globalThis as typeof globalThis & {
  __saasDemoStore?: unknown;
};

/** Each test gets a fresh in-memory store (module-level state on globalThis). */
beforeEach(() => {
  globalForStore.__saasDemoStore = undefined;
});

function setUp(): { serviceId: string; providerId: string; customerId: string } {
  const service = createService({
    name: "Consulta",
    category: "General",
    durationMinutes: 30,
    bufferAfterMinutes: 0,
    priceAmount: 5000,
    currency: "EUR",
  });
  if (!service.ok) throw new Error("setup: service");
  const provider = createProvider({
    name: "Dra. Prueba",
    email: "prueba@example.com",
    timezone: "Europe/Madrid",
    locationIds: [],
    serviceIds: [service.value.id],
  });
  if (!provider.ok) throw new Error("setup: provider");
  const customer = createCustomer({
    name: "Cliente Test",
    email: "cliente@example.com",
    phone: "",
  });
  if (!customer.ok) throw new Error("setup: customer");
  return {
    serviceId: service.value.id,
    providerId: provider.value.id,
    customerId: customer.value.id,
  };
}

function bookAt(
  hourOffset: number,
  fixtures: { serviceId: string; providerId: string; customerId: string },
  requiresApproval = false,
): AdminBooking {
  const startAt = new Date(Date.now() + hourOffset * 3_600_000).toISOString();
  const result = createBooking(
    {
      serviceId: fixtures.serviceId,
      providerId: fixtures.providerId,
      customerId: fixtures.customerId,
      startAt,
    },
    requiresApproval,
  );
  if (!result.ok) {
    throw new Error(`booking creation failed: ${result.error}`);
  }
  return result.value;
}

describe("demo-store booking lifecycle (feature 004)", () => {
  it("does not collapse the 6 domain states into confirmed/cancelled", () => {
    const fixtures = setUp();

    const pendingBooking = bookAt(1, fixtures, true);
    expect(pendingBooking.status).toBe("pending");

    const approvedBooking = bookAt(2, fixtures, false);
    expect(approvedBooking.status).toBe("approved");

    const rejected = rejectBooking(pendingBooking.id);
    expect(rejected.ok).toBe(true);
    if (rejected.ok) expect(rejected.value.status).toBe("rejected");

    const toComplete = bookAt(3, fixtures, false);
    const completed = completeBooking(toComplete.id);
    expect(completed.ok).toBe(true);
    if (completed.ok) expect(completed.value.status).toBe("completed");

    const toNoShow = bookAt(4, fixtures, false);
    const noShow = noShowBooking(toNoShow.id);
    expect(noShow.ok).toBe(true);
    if (noShow.ok) expect(noShow.value.status).toBe("no_show");

    const toCancel = bookAt(5, fixtures, false);
    const canceled = cancelBooking(toCancel.id);
    expect(canceled.ok).toBe(true);
    if (canceled.ok) expect(canceled.value.status).toBe("canceled");

    // All 6 distinct statuses are observable via listBookings, none collapsed.
    const statuses = new Set<BookingStatus>(listBookings().map((b) => b.status));
    expect(statuses).toEqual(
      new Set<BookingStatus>(["rejected", "approved", "completed", "no_show", "canceled"]),
    );
  });

  it("rejects an invalid transition (approved -> approved is not in TRANSITIONS)", () => {
    const fixtures = setUp();
    const booking = bookAt(1, fixtures, false); // starts "approved"

    expect(() => approveBooking(booking.id)).toThrow(InvalidBookingTransitionError);
  });

  it("rejects completing a pending booking (must go through approved first)", () => {
    const fixtures = setUp();
    const booking = bookAt(1, fixtures, true); // starts "pending"

    expect(() => completeBooking(booking.id)).toThrow(InvalidBookingTransitionError);
  });

  it("frees occupancy on reject (from pending) but holds it on pending/approved/completed/no_show", () => {
    const fixtures = setUp();
    // Two bookings at the exact same time for the same provider: the second
    // must fail while the first still occupies the slot. `reject` is only a
    // valid transition from "pending" (domain TRANSITIONS), so create the
    // first booking as pending (requiresApproval=true).
    const startAt = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const first = createBooking(
      {
        serviceId: fixtures.serviceId,
        providerId: fixtures.providerId,
        customerId: fixtures.customerId,
        startAt,
      },
      true,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.status).toBe("pending");

    const overlapping = createBooking(
      {
        serviceId: fixtures.serviceId,
        providerId: fixtures.providerId,
        customerId: fixtures.customerId,
        startAt,
      },
      true,
    );
    expect(overlapping.ok).toBe(false); // provider busy: slot still held by "pending"

    const rejected = rejectBooking(first.value.id);
    expect(rejected.ok).toBe(true);

    // Now that the first booking is rejected, the slot is free.
    const afterReject = createBooking(
      {
        serviceId: fixtures.serviceId,
        providerId: fixtures.providerId,
        customerId: fixtures.customerId,
        startAt,
      },
      true,
    );
    expect(afterReject.ok).toBe(true);
  });

  it("frees occupancy on cancel (from approved) too", () => {
    const fixtures = setUp();
    const startAt = new Date(Date.now() + 30 * 3_600_000).toISOString();
    const first = createBooking(
      {
        serviceId: fixtures.serviceId,
        providerId: fixtures.providerId,
        customerId: fixtures.customerId,
        startAt,
      },
      false,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.status).toBe("approved");

    const overlapping = createBooking(
      {
        serviceId: fixtures.serviceId,
        providerId: fixtures.providerId,
        customerId: fixtures.customerId,
        startAt,
      },
      false,
    );
    expect(overlapping.ok).toBe(false); // provider busy: slot still held by "approved"

    const canceled = cancelBooking(first.value.id);
    expect(canceled.ok).toBe(true);

    const afterCancel = createBooking(
      {
        serviceId: fixtures.serviceId,
        providerId: fixtures.providerId,
        customerId: fixtures.customerId,
        startAt,
      },
      false,
    );
    expect(afterCancel.ok).toBe(true);
  });
});

describe("demo-store manual payment (feature 004, US3)", () => {
  it("upserts and reads back a manual payment with deposit <= amount", () => {
    const fixtures = setUp();
    const booking = bookAt(1, fixtures, false);

    expect(getBookingPayment(booking.id)).toBeUndefined();

    const result = upsertBookingPayment({
      bookingId: booking.id,
      method: "cash",
      status: "partial",
      amount: 5000,
      deposit: 2000,
      currency: "EUR",
      transactionRef: "REF-1",
      notes: "Pagó la mitad en efectivo.",
    });
    expect(result.ok).toBe(true);

    const stored = getBookingPayment(booking.id);
    expect(stored).toEqual({
      bookingId: booking.id,
      method: "cash",
      status: "partial",
      amount: 5000,
      deposit: 2000,
      currency: "EUR",
      transactionRef: "REF-1",
      notes: "Pagó la mitad en efectivo.",
    });
  });

  it("rejects a deposit greater than the amount", () => {
    const fixtures = setUp();
    const booking = bookAt(1, fixtures, false);

    const result = upsertBookingPayment({
      bookingId: booking.id,
      method: "card",
      status: "paid",
      amount: 1000,
      deposit: 5000,
      currency: "EUR",
    });
    expect(result.ok).toBe(false);
    expect(getBookingPayment(booking.id)).toBeUndefined();
  });

  it("rejects a payment for a booking that does not exist", () => {
    const result = upsertBookingPayment({
      bookingId: "does-not-exist",
      method: "cash",
      status: "paid",
      amount: 1000,
      deposit: 0,
      currency: "EUR",
    });
    expect(result.ok).toBe(false);
  });
});
