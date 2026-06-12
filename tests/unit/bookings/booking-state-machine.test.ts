/**
 * T030: booking state machine — pending/approved/rejected/expired/canceled
 * transitions, terminal states, and emitted event types.
 */

import { describe, expect, it } from "vitest";
import {
  canTransition,
  InvalidBookingTransitionError,
  transitionBooking,
  transitionEventType,
  type Booking,
  type BookingStatus,
} from "@saas-reservas/domain/bookings/booking";

const booking = (status: BookingStatus): Booking => ({
  id: "bk-1",
  tenantId: "00000000-0000-4000-8000-000000000001",
  customerId: "cus-1",
  serviceId: "svc-1",
  providerId: "prov-1",
  status,
  startAt: "2026-06-15T09:00:00.000Z",
  endAt: "2026-06-15T10:00:00.000Z",
  durationMinutes: 60,
  attendees: 1,
  extras: [],
  totalAmount: 5000,
  currency: "EUR",
  source: "widget",
});

describe("booking state machine", () => {
  it("allows pending -> approved | rejected | expired", () => {
    for (const to of ["approved", "rejected", "expired"] as const) {
      expect(transitionBooking(booking("pending"), to).status).toBe(to);
    }
  });

  it("allows approved -> canceled | rescheduled", () => {
    for (const to of ["canceled", "rescheduled"] as const) {
      expect(transitionBooking(booking("approved"), to).status).toBe(to);
    }
  });

  it("rejects skipping pending and reviving terminal states", () => {
    expect(() => transitionBooking(booking("pending"), "canceled")).toThrow(
      InvalidBookingTransitionError,
    );
    for (const terminal of ["rejected", "expired", "canceled", "rescheduled"] as const) {
      for (const to of ["pending", "approved", "canceled"] as const) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
    expect(() => transitionBooking(booking("approved"), "approved")).toThrow(
      InvalidBookingTransitionError,
    );
  });

  it("never mutates the input booking and names events booking.<state>", () => {
    const pending = booking("pending");
    const approved = transitionBooking(pending, "approved");
    expect(pending.status).toBe("pending");
    expect(approved.status).toBe("approved");
    expect(transitionEventType("approved")).toBe("booking.approved");
    expect(transitionEventType("expired")).toBe("booking.expired");
  });
});
