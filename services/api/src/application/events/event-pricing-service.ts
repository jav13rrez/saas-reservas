/**
 * Event capacity and ticket pricing (T057): applies dynamic pricing rules to
 * the ticket base price. Early-bird discounts apply while the purchase happens
 * early enough before the event start; occupancy surcharges apply once sales
 * cross a threshold of total capacity. Discounts compute before surcharges;
 * percent math rounds half-up per step on integer minor units.
 */

import type {
  BookableEvent,
  DynamicPricingRule,
  TicketType,
} from "@saas-reservas/domain/events/event";

const DAY_MS = 86_400_000;

export interface TicketPriceBreakdown {
  unitBaseAmount: number;
  unitFinalAmount: number;
  quantity: number;
  totalAmount: number;
  appliedRules: DynamicPricingRule["type"][];
}

function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

export function priceTicket(input: {
  event: BookableEvent;
  ticket: TicketType;
  quantity: number;
  /** Confirmed seats already sold for the whole event. */
  eventSoldCount: number;
  now: Date;
}): TicketPriceBreakdown {
  const { event, ticket, quantity, eventSoldCount, now } = input;
  const appliedRules: DynamicPricingRule["type"][] = [];
  let unit = ticket.priceAmount;

  for (const rule of ticket.dynamicPricingRules) {
    if (rule.type === "early-bird") {
      const cutoff = Date.parse(event.startAt) - rule.daysBeforeStart * DAY_MS;
      if (now.getTime() <= cutoff) {
        unit -= percentOf(ticket.priceAmount, rule.discountPercent);
        appliedRules.push("early-bird");
      }
    }
  }
  for (const rule of ticket.dynamicPricingRules) {
    if (rule.type === "occupancy") {
      const soldPercent = (eventSoldCount / event.totalCapacity) * 100;
      if (soldPercent > rule.aboveSoldPercent) {
        unit += percentOf(unit, rule.surchargePercent);
        appliedRules.push("occupancy");
      }
    }
  }

  const unitFinalAmount = Math.max(unit, 0);
  return {
    unitBaseAmount: ticket.priceAmount,
    unitFinalAmount,
    quantity,
    totalAmount: unitFinalAmount * quantity,
    appliedRules,
  };
}
