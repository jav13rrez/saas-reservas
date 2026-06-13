/**
 * Booking aggregate: customer, booking, attendees, extras, and the booking
 * state machine (T032).
 *
 * Money is always integer minor units (cents); durations are minutes; instants
 * are ISO-8601 UTC strings at this boundary.
 */

export interface Customer {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gdprStatus: "active" | "anonymized";
}

export type BookingStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "canceled"
  | "rescheduled";

/** A selected extra with the unit price captured at booking time. */
export interface BookingExtra {
  extraId: string;
  quantity: number;
  unitPriceAmount: number;
  multipliedByPeople: boolean;
}

export interface Booking {
  id: string;
  tenantId: string;
  customerId: string;
  serviceId: string;
  providerId: string;
  status: BookingStatus;
  /** Customer-facing appointment start/end, ISO-8601 UTC. */
  startAt: string;
  endAt: string;
  durationMinutes: number;
  attendees: number;
  extras: BookingExtra[];
  totalAmount: number;
  currency: string;
  source: "widget" | "admin" | "api";
}

/**
 * Allowed transitions (data-model.md):
 *   pending  -> approved | rejected | expired
 *   approved -> canceled | rescheduled
 * Everything else is invalid; terminal states have no outgoing transitions.
 */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["approved", "rejected", "expired"],
  approved: ["canceled", "rescheduled"],
  rejected: [],
  expired: [],
  canceled: [],
  rescheduled: [],
};

export class InvalidBookingTransitionError extends Error {
  constructor(
    readonly from: BookingStatus,
    readonly to: BookingStatus,
  ) {
    super(`Invalid booking transition: ${from} -> ${to}`);
    this.name = "InvalidBookingTransitionError";
  }
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Event type emitted for each transition, e.g. "booking.approved". */
export function transitionEventType(to: BookingStatus): string {
  return `booking.${to}`;
}

/** Returns a new booking in the target state; never mutates the input. */
export function transitionBooking(booking: Booking, to: BookingStatus): Booking {
  if (!canTransition(booking.status, to)) {
    throw new InvalidBookingTransitionError(booking.status, to);
  }
  return { ...booking, status: to };
}
