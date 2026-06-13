/**
 * T052: early-bird and dynamic (occupancy) event pricing.
 */

import { describe, expect, it } from "vitest";
import type { BookableEvent, TicketType } from "@saas-reservas/domain/events/event";
import { priceTicket } from "@saas-reservas/api/application/events/event-pricing-service";

const TENANT = "00000000-0000-4000-8000-000000000001";

const event: BookableEvent = {
  id: "evt-1",
  tenantId: TENANT,
  name: "Concert",
  startAt: "2026-07-31T20:00:00.000Z",
  endAt: "2026-07-31T23:00:00.000Z",
  totalCapacity: 100,
  minCapacity: 0,
  status: "published",
};

const ticket: TicketType = {
  id: "tt-1",
  tenantId: TENANT,
  eventId: event.id,
  name: "General",
  priceAmount: 10000, // 100.00
  dynamicPricingRules: [
    { type: "early-bird", daysBeforeStart: 30, discountPercent: 20 },
    { type: "occupancy", aboveSoldPercent: 80, surchargePercent: 10 },
  ],
  status: "active",
};

describe("event pricing", () => {
  it("applies the early-bird discount before the cutoff and full price after", () => {
    const early = priceTicket({
      event,
      ticket,
      quantity: 2,
      eventSoldCount: 0,
      now: new Date("2026-06-15T10:00:00Z"), // 46 days before
    });
    expect(early.unitFinalAmount).toBe(8000);
    expect(early.totalAmount).toBe(16000);
    expect(early.appliedRules).toEqual(["early-bird"]);

    const late = priceTicket({
      event,
      ticket,
      quantity: 2,
      eventSoldCount: 0,
      now: new Date("2026-07-15T10:00:00Z"), // 16 days before
    });
    expect(late.unitFinalAmount).toBe(10000);
    expect(late.appliedRules).toEqual([]);
  });

  it("adds the occupancy surcharge once sales cross the threshold", () => {
    const below = priceTicket({
      event,
      ticket,
      quantity: 1,
      eventSoldCount: 80, // exactly 80%: not above
      now: new Date("2026-07-15T10:00:00Z"),
    });
    expect(below.unitFinalAmount).toBe(10000);

    const above = priceTicket({
      event,
      ticket,
      quantity: 1,
      eventSoldCount: 81,
      now: new Date("2026-07-15T10:00:00Z"),
    });
    expect(above.unitFinalAmount).toBe(11000);
    expect(above.appliedRules).toEqual(["occupancy"]);
  });

  it("combines rules: surcharge applies on the discounted price", () => {
    const both = priceTicket({
      event,
      ticket,
      quantity: 1,
      eventSoldCount: 90,
      now: new Date("2026-06-01T10:00:00Z"),
    });
    // 10000 - 20% = 8000, +10% = 8800
    expect(both.unitFinalAmount).toBe(8800);
    expect(both.appliedRules).toEqual(["early-bird", "occupancy"]);
  });

  it("never prices below zero and keeps the base amount in the breakdown", () => {
    const generous: TicketType = {
      ...ticket,
      dynamicPricingRules: [{ type: "early-bird", daysBeforeStart: 1, discountPercent: 100 }],
    };
    const result = priceTicket({
      event,
      ticket: generous,
      quantity: 3,
      eventSoldCount: 0,
      now: new Date("2026-06-01T00:00:00Z"),
    });
    expect(result.unitFinalAmount).toBe(0);
    expect(result.unitBaseAmount).toBe(10000);
    expect(result.totalAmount).toBe(0);
  });
});
