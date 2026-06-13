/**
 * Event-ticketing aggregate (T056): events sold by capacity (independent of
 * providers), ticket types with optional per-ticket capacity and dynamic
 * pricing rules, attendees, recurring series, and the waitlist state machine.
 *
 * Capacity model: `totalCapacity` is the shared seat pool of the event; a
 * ticket type may additionally cap its own sales (`capacity`), e.g. 100 seats
 * total of which at most 20 VIP. Amounts are integer minor units.
 */

export interface EventSeries {
  id: string;
  tenantId: string;
  name: string;
}

export type EventStatus = "draft" | "published" | "canceled";

/** A bookable event instance; recurring instances are independent records. */
export interface BookableEvent {
  id: string;
  tenantId: string;
  /** Present when the instance belongs to a recurring series. */
  seriesId?: string;
  name: string;
  startAt: string;
  endAt: string;
  totalCapacity: number;
  minCapacity: number;
  status: EventStatus;
}

export type DynamicPricingRule =
  | {
      /** Discount while booking happens early enough before the event starts. */
      type: "early-bird";
      daysBeforeStart: number;
      discountPercent: number;
    }
  | {
      /** Surcharge once occupancy crosses a threshold (demand pricing). */
      type: "occupancy";
      aboveSoldPercent: number;
      surchargePercent: number;
    };

export interface TicketType {
  id: string;
  tenantId: string;
  eventId: string;
  name: string;
  priceAmount: number;
  /** Per-ticket sales cap; undefined means only the shared pool limits sales. */
  capacity?: number;
  dynamicPricingRules: DynamicPricingRule[];
  status: "active" | "inactive";
}

export interface EventAttendee {
  id: string;
  tenantId: string;
  eventId: string;
  ticketTypeId: string;
  customerId: string;
  quantity: number;
  status: "confirmed" | "canceled";
}

export type WaitlistStatus = "waiting" | "offered" | "approved" | "expired" | "canceled";

/**
 * Waitlist state machine (data-model.md):
 *   waiting -> offered | canceled
 *   offered -> approved | expired
 */
export interface WaitlistEntry {
  id: string;
  tenantId: string;
  eventId: string;
  customerId: string;
  priorityScore: number;
  status: WaitlistStatus;
  /** SHA-256 of the claim token; the raw token is only ever sent to the customer. */
  claimTokenHash?: string;
  claimExpiresAt?: string;
}

export class InvalidEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEventError";
  }
}

export function validateEvent(event: BookableEvent): void {
  if (!Number.isInteger(event.totalCapacity) || event.totalCapacity < 1) {
    throw new InvalidEventError("event total capacity must be a positive integer");
  }
  if (!Number.isInteger(event.minCapacity) || event.minCapacity < 0) {
    throw new InvalidEventError("event min capacity must be a non-negative integer");
  }
  if (event.minCapacity > event.totalCapacity) {
    throw new InvalidEventError("event min capacity cannot exceed total capacity");
  }
  if (Date.parse(event.endAt) <= Date.parse(event.startAt)) {
    throw new InvalidEventError("event must end after it starts");
  }
}

export function validateTicketType(ticket: TicketType): void {
  if (ticket.priceAmount < 0) {
    throw new InvalidEventError("ticket price cannot be negative");
  }
  if (
    ticket.capacity !== undefined &&
    (!Number.isInteger(ticket.capacity) || ticket.capacity < 1)
  ) {
    throw new InvalidEventError("ticket capacity must be a positive integer when set");
  }
}

/** Confirmed seats sold for the whole event, or for one ticket type. */
export function soldCount(attendees: EventAttendee[], ticketTypeId?: string): number {
  return attendees
    .filter(
      (attendee) =>
        attendee.status === "confirmed" &&
        (ticketTypeId === undefined || attendee.ticketTypeId === ticketTypeId),
    )
    .reduce((sum, attendee) => sum + attendee.quantity, 0);
}

export type PurchaseDecision =
  | { ok: true }
  | {
      ok: false;
      reason: "event-not-published" | "invalid-quantity" | "event-full" | "ticket-full";
    };

/** Checks shared event capacity and the ticket type's own cap, if any. */
export function canPurchase(input: {
  event: BookableEvent;
  ticket: TicketType;
  attendees: EventAttendee[];
  quantity: number;
}): PurchaseDecision {
  const { event, ticket, attendees, quantity } = input;
  if (event.status !== "published" || ticket.status !== "active") {
    return { ok: false, reason: "event-not-published" };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, reason: "invalid-quantity" };
  }
  if (soldCount(attendees) + quantity > event.totalCapacity) {
    return { ok: false, reason: "event-full" };
  }
  if (
    ticket.capacity !== undefined &&
    soldCount(attendees, ticket.id) + quantity > ticket.capacity
  ) {
    return { ok: false, reason: "ticket-full" };
  }
  return { ok: true };
}
