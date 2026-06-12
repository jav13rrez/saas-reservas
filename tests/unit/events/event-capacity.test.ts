/**
 * T051: event capacity, ticket categories, and attendee limits — shared pool
 * vs per-ticket caps, sellout blocking direct purchase (spec US4 scenario 1).
 */

import { describe, expect, it } from "vitest";
import {
  canPurchase,
  soldCount,
  validateEvent,
  validateTicketType,
  type BookableEvent,
  type EventAttendee,
  type TicketType,
} from "@saas-reservas/domain/events/event";

const TENANT = "00000000-0000-4000-8000-000000000001";

const event: BookableEvent = {
  id: "evt-1",
  tenantId: TENANT,
  name: "Workshop",
  startAt: "2026-07-01T10:00:00.000Z",
  endAt: "2026-07-01T12:00:00.000Z",
  totalCapacity: 10,
  minCapacity: 0,
  status: "published",
};

const general: TicketType = {
  id: "tt-general",
  tenantId: TENANT,
  eventId: event.id,
  name: "General",
  priceAmount: 2000,
  dynamicPricingRules: [],
  status: "active",
};

const vip: TicketType = { ...general, id: "tt-vip", name: "VIP", priceAmount: 5000, capacity: 2 };

function attendee(
  ticketTypeId: string,
  quantity: number,
  status: EventAttendee["status"] = "confirmed",
): EventAttendee {
  return {
    id: `att-${ticketTypeId}-${String(quantity)}-${String(Math.random())}`,
    tenantId: TENANT,
    eventId: event.id,
    ticketTypeId,
    customerId: "cus-1",
    quantity,
    status,
  };
}

describe("event capacity", () => {
  it("counts only confirmed attendees, per event and per ticket type", () => {
    const attendees = [
      attendee(general.id, 3),
      attendee(vip.id, 1),
      attendee(general.id, 2, "canceled"),
    ];
    expect(soldCount(attendees)).toBe(4);
    expect(soldCount(attendees, general.id)).toBe(3);
    expect(soldCount(attendees, vip.id)).toBe(1);
  });

  it("shares the total pool across ticket categories", () => {
    // 8 general + 1 vip = 9 of 10 sold; 2 more general exceed the shared pool.
    const attendees = [attendee(general.id, 8), attendee(vip.id, 1)];
    expect(canPurchase({ event, ticket: general, attendees, quantity: 1 })).toEqual({ ok: true });
    expect(canPurchase({ event, ticket: general, attendees, quantity: 2 })).toEqual({
      ok: false,
      reason: "event-full",
    });
  });

  it("enforces the per-ticket cap even when the shared pool has room", () => {
    const attendees = [attendee(vip.id, 2)]; // VIP cap (2) reached, pool at 2/10
    expect(canPurchase({ event, ticket: vip, attendees, quantity: 1 })).toEqual({
      ok: false,
      reason: "ticket-full",
    });
    expect(canPurchase({ event, ticket: general, attendees, quantity: 1 })).toEqual({ ok: true });
  });

  it("blocks direct purchase once sold out (waitlist takes over)", () => {
    const attendees = [attendee(general.id, 10)];
    expect(canPurchase({ event, ticket: general, attendees, quantity: 1 })).toEqual({
      ok: false,
      reason: "event-full",
    });
  });

  it("rejects unpublished events, inactive tickets, and invalid quantities", () => {
    expect(
      canPurchase({
        event: { ...event, status: "draft" },
        ticket: general,
        attendees: [],
        quantity: 1,
      }),
    ).toEqual({ ok: false, reason: "event-not-published" });
    expect(
      canPurchase({
        event,
        ticket: { ...general, status: "inactive" },
        attendees: [],
        quantity: 1,
      }),
    ).toEqual({ ok: false, reason: "event-not-published" });
    expect(canPurchase({ event, ticket: general, attendees: [], quantity: 0 })).toEqual({
      ok: false,
      reason: "invalid-quantity",
    });
  });

  it("validates event and ticket invariants", () => {
    expect(() => validateEvent(event)).not.toThrow();
    expect(() => validateEvent({ ...event, totalCapacity: 0 })).toThrow();
    expect(() => validateEvent({ ...event, minCapacity: 11 })).toThrow();
    expect(() => validateEvent({ ...event, endAt: event.startAt })).toThrow();
    expect(() => validateTicketType(vip)).not.toThrow();
    expect(() => validateTicketType({ ...vip, capacity: 0 })).toThrow();
    expect(() => validateTicketType({ ...vip, priceAmount: -1 })).toThrow();
  });
});
