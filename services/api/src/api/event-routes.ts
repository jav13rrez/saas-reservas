/**
 * Admin event APIs and public event booking flow (T061).
 *
 * Sales rules (spec US4): purchases check the shared pool and per-ticket caps
 * with dynamic pricing applied; a sold-out event blocks direct purchase and
 * enrolls the customer in the waitlist (scenario 1); canceling an attendee
 * protects the freed seat by promoting the best waitlist candidate with a TTL
 * claim token (scenario 2); series edits propagate per scope (scenario 3).
 * Payment for event tickets reuses the cart flow and lands with the events
 * payment tasks; admin routes remain dev-only until staff auth.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";
import {
  canPurchase,
  soldCount,
  validateEvent,
  validateTicketType,
  type BookableEvent,
  type DynamicPricingRule,
  type EventAttendee,
  type TicketType,
} from "@saas-reservas/domain/events/event";
import { priceTicket } from "../application/events/event-pricing-service.js";
import type { EventStore } from "../application/events/event-store.js";
import type {
  RecurrenceScope,
  RecurringEventService,
  SeriesChanges,
} from "../application/events/recurring-event-service.js";
import { EventNotFoundError } from "../application/events/recurring-event-service.js";
import type { WaitlistService } from "../application/events/waitlist-service.js";

export interface EventDeps {
  store: EventStore;
  waitlist: WaitlistService;
  recurring: RecurringEventService;
}

export function registerEventRoutes(app: FastifyInstance, deps: EventDeps): void {
  app.post("/v1/admin/events", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const body = request.body as {
      name: string;
      seriesId?: string;
      startAt: string;
      endAt: string;
      totalCapacity: number;
      minCapacity?: number;
    };
    const event: BookableEvent = {
      id: randomUUID(),
      tenantId: tenant.tenantId,
      ...(body.seriesId !== undefined ? { seriesId: body.seriesId } : {}),
      name: body.name,
      startAt: body.startAt,
      endAt: body.endAt,
      totalCapacity: body.totalCapacity,
      minCapacity: body.minCapacity ?? 0,
      status: "published",
    };
    validateEvent(event);
    await deps.store.insertEvent(event);
    return reply.code(201).send(event);
  });

  app.post("/v1/admin/events/:eventId/tickets", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const { eventId } = request.params as { eventId: string };
    const body = request.body as {
      name: string;
      priceAmount: number;
      capacity?: number;
      dynamicPricingRules?: DynamicPricingRule[];
    };
    const ticket: TicketType = {
      id: randomUUID(),
      tenantId: tenant.tenantId,
      eventId,
      name: body.name,
      priceAmount: body.priceAmount,
      ...(body.capacity !== undefined ? { capacity: body.capacity } : {}),
      dynamicPricingRules: body.dynamicPricingRules ?? [],
      status: "active",
    };
    validateTicketType(ticket);
    await deps.store.insertTicketType(ticket);
    return reply.code(201).send(ticket);
  });

  app.patch("/v1/admin/events/:eventId", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const { eventId } = request.params as { eventId: string };
    const body = request.body as { scope?: RecurrenceScope; changes: SeriesChanges };
    try {
      const updated = await deps.recurring.updateWithScope({
        tenantId: tenant.tenantId,
        eventId,
        scope: body.scope ?? "this-only",
        changes: body.changes,
        actor: SYSTEM_ACTOR, // staff auth pending
      });
      return await reply.send({ updated: updated.map((event) => event.id) });
    } catch (error) {
      if (error instanceof EventNotFoundError) {
        return reply.code(404).send({ error: "event-not-found" });
      }
      throw error;
    }
  });

  app.get("/v1/public/events/:eventId", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const { eventId } = request.params as { eventId: string };
    const event = await deps.store.findEventById(tenant.tenantId, eventId);
    if (event?.status !== "published") {
      return reply.code(404).send({ error: "event-not-found" });
    }
    const attendees = await deps.store.listAttendees(tenant.tenantId, eventId);
    const sold = soldCount(attendees);
    const tickets = await deps.store.listTicketTypes(tenant.tenantId, eventId);
    const now = new Date();
    return reply.send({
      event,
      remainingCapacity: event.totalCapacity - sold,
      tickets: tickets
        .filter((ticket) => ticket.status === "active")
        .map((ticket) => ({
          id: ticket.id,
          name: ticket.name,
          pricing: priceTicket({ event, ticket, quantity: 1, eventSoldCount: sold, now }),
        })),
    });
  });

  app.post("/v1/public/events/:eventId/purchases", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const { eventId } = request.params as { eventId: string };
    const body = request.body as { ticketTypeId: string; quantity?: number; customerId: string };
    const quantity = body.quantity ?? 1;

    const event = await deps.store.findEventById(tenant.tenantId, eventId);
    const ticket = await deps.store.findTicketTypeById(tenant.tenantId, body.ticketTypeId);
    if (event === null || ticket?.eventId !== eventId) {
      return reply.code(404).send({ error: "event-not-found" });
    }
    const attendees = await deps.store.listAttendees(tenant.tenantId, eventId);
    const decision = canPurchase({ event, ticket, attendees, quantity });

    if (!decision.ok && (decision.reason === "event-full" || decision.reason === "ticket-full")) {
      // Sold out: direct purchase is blocked and the waitlist takes over.
      const entry = await deps.waitlist.join({
        tenantId: tenant.tenantId,
        eventId,
        customerId: body.customerId,
        actor: { type: "customer", id: body.customerId },
      });
      return reply.code(409).send({ error: decision.reason, waitlistEntryId: entry.id });
    }
    if (!decision.ok) {
      return reply.code(400).send({ error: decision.reason });
    }

    const pricing = priceTicket({
      event,
      ticket,
      quantity,
      eventSoldCount: soldCount(attendees),
      now: new Date(),
    });
    const attendee: EventAttendee = {
      id: randomUUID(),
      tenantId: tenant.tenantId,
      eventId,
      ticketTypeId: ticket.id,
      customerId: body.customerId,
      quantity,
      status: "confirmed",
    };
    await deps.store.insertAttendee(attendee);
    return reply.code(201).send({ attendeeId: attendee.id, pricing });
  });

  app.post("/v1/public/events/:eventId/attendees/:attendeeId/cancel", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const { eventId, attendeeId } = request.params as { eventId: string; attendeeId: string };
    const attendee = await deps.store.findAttendeeById(tenant.tenantId, attendeeId);
    if (attendee?.eventId !== eventId || attendee.status !== "confirmed") {
      return reply.code(404).send({ error: "attendee-not-found" });
    }
    await deps.store.updateAttendee({ ...attendee, status: "canceled" });

    // Protect the freed seat: offer it to the best waitlist candidate.
    const promotion = await deps.waitlist.promoteNext({ tenantId: tenant.tenantId, eventId });
    return reply.send({
      canceled: attendee.id,
      promoted:
        promotion === null
          ? null
          : {
              waitlistEntryId: promotion.entry.id,
              customerId: promotion.entry.customerId,
              claimExpiresAt: promotion.entry.claimExpiresAt,
              // Returned for delivery to the customer (email/SMS in production).
              claimToken: promotion.claimToken,
            },
    });
  });

  app.post("/v1/public/events/:eventId/waitlist/claim", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const { eventId } = request.params as { eventId: string };
    const body = request.body as { claimToken: string; ticketTypeId: string };

    const result = await deps.waitlist.claim({
      tenantId: tenant.tenantId,
      eventId,
      claimToken: body.claimToken,
    });
    if (!result.ok) {
      return reply.code(result.reason === "expired" ? 410 : 401).send({ error: result.reason });
    }
    // The protected seat becomes a confirmed attendee for the claimant.
    const attendee: EventAttendee = {
      id: randomUUID(),
      tenantId: tenant.tenantId,
      eventId,
      ticketTypeId: body.ticketTypeId,
      customerId: result.entry.customerId,
      quantity: 1,
      status: "confirmed",
    };
    await deps.store.insertAttendee(attendee);
    return reply.code(201).send({ attendeeId: attendee.id, waitlistEntryId: result.entry.id });
  });
}
