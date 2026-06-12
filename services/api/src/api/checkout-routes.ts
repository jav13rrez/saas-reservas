/**
 * Public booking checkout API (T040, API half).
 *
 * Flow (spec US2): validate the requested slot against the availability
 * engine -> acquire Redis-style slot locks for provider/resources -> create a
 * Pending booking -> create cart + subpayment and charge the gateway ->
 * webhook (idempotent) approves the booking and releases locks, or a declined
 * charge rejects it immediately. Lock TTL expiry frees abandoned checkouts.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";
import {
  appointmentDurationMinutes,
  totalDurationMinutes,
} from "@saas-reservas/domain/catalog/service";
import { MINUTE_MS, type Interval } from "@saas-reservas/domain/scheduling/time";
import type { BookingService } from "../application/bookings/booking-service.js";
import type { CatalogRepository } from "../application/catalog/catalog-service.js";
import type { CartReconciliationService } from "../application/payments/cart-reconciliation-service.js";
import { priceBooking } from "../application/payments/pricing-service.js";
import type { AvailabilityService } from "../application/scheduling/availability-service.js";
import type {
  CheckoutLockService,
  SlotRef,
} from "../application/scheduling/checkout-lock-service.js";
import type {
  WebhookEvent,
  WebhookProcessor,
} from "../infrastructure/payments/payment-webhooks.js";

export interface OccupancyRecorder {
  /** Persists confirmed occupancy so the availability engine sees it. */
  recordBookingOccupancy(
    tenantId: string,
    providerId: string,
    occupied: Interval,
    resources: { resourceId: string; units: number }[],
    bookingId?: string,
  ): void | Promise<void>;
  /** Frees the occupancy of a canceled/rescheduled booking. */
  releaseBookingOccupancy(tenantId: string, bookingId: string): void | Promise<void>;
}

/** Provisional checkout hold awaiting the payment webhook. */
export interface CheckoutHold {
  tenantId: string;
  bookingId: string;
  providerId: string;
  occupied: Interval;
  resources: { resourceId: string; units: number }[];
  slots: { slot: SlotRef; token: string }[];
}

export interface HoldStore {
  save(cartId: string, hold: CheckoutHold): Promise<void>;
  find(tenantId: string, cartId: string): Promise<CheckoutHold | null>;
  remove(tenantId: string, cartId: string): Promise<void>;
}

/** Default store for tests/dev; production wires the persistence adapter. */
export class InMemoryHoldStore implements HoldStore {
  private readonly holds = new Map<string, CheckoutHold>();

  save(cartId: string, hold: CheckoutHold): Promise<void> {
    this.holds.set(cartId, hold);
    return Promise.resolve();
  }

  find(tenantId: string, cartId: string): Promise<CheckoutHold | null> {
    const hold = this.holds.get(cartId);
    return Promise.resolve(hold?.tenantId === tenantId ? hold : null);
  }

  remove(tenantId: string, cartId: string): Promise<void> {
    const hold = this.holds.get(cartId);
    if (hold?.tenantId === tenantId) {
      this.holds.delete(cartId);
    }
    return Promise.resolve();
  }
}

export interface CheckoutDeps {
  catalog: CatalogRepository;
  availability: AvailabilityService;
  locks: CheckoutLockService;
  bookings: BookingService;
  carts: CartReconciliationService;
  webhooks: WebhookProcessor;
  occupancy: OccupancyRecorder;
  /** Defaults to the in-memory store when omitted. */
  holds?: HoldStore;
  tenantTimezone(tenantId: string): Promise<string>;
}

interface CheckoutBody {
  serviceId: string;
  providerId?: string;
  /** Appointment start, ISO-8601 UTC; must match an offered slot. */
  startAt: string;
  date: string;
  attendees?: number;
  extraIds?: string[];
  customer: { email: string; firstName: string; lastName: string };
}

export function registerCheckoutRoutes(app: FastifyInstance, deps: CheckoutDeps): void {
  const holds: HoldStore = deps.holds ?? new InMemoryHoldStore();

  async function releaseHold(hold: CheckoutHold): Promise<void> {
    for (const { slot, token } of hold.slots) {
      await deps.locks.release(slot, token);
    }
  }

  app.post("/v1/public/checkout", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const body = request.body as CheckoutBody;
    const attendees = body.attendees ?? 1;

    const availability = await deps.availability.availability({
      tenantId: tenant.tenantId,
      serviceId: body.serviceId,
      date: body.date,
      ...(body.providerId !== undefined ? { providerId: body.providerId } : {}),
      ...(body.extraIds !== undefined ? { extraIds: body.extraIds } : {}),
      tenantTimezone: await deps.tenantTimezone(tenant.tenantId),
    });
    if (!availability.ok) {
      const status = availability.reason === "service-not-found" ? 404 : 400;
      return reply.code(status).send({ error: availability.reason });
    }
    const offered = availability.slots.find(
      (slot) => Date.parse(slot.startAt) === Date.parse(body.startAt),
    );
    if (offered === undefined) {
      return reply.code(409).send({ error: "slot-not-available" });
    }

    const service = await deps.catalog.findServiceById(tenant.tenantId, body.serviceId);
    if (service === null) {
      return reply.code(404).send({ error: "service-not-found" });
    }
    const extras = await deps.catalog.listExtras(
      tenant.tenantId,
      body.serviceId,
      body.extraIds ?? [],
    );
    const demands = await deps.catalog.listResourceDemands(tenant.tenantId, body.serviceId);

    // Occupied interval includes buffers; locks key on the occupied start.
    const appointmentStartMs = Date.parse(body.startAt);
    const occupiedStartMs = appointmentStartMs - service.bufferBeforeMinutes * MINUTE_MS;
    const occupied: Interval = {
      start: occupiedStartMs,
      end: occupiedStartMs + totalDurationMinutes(service, extras) * MINUTE_MS,
    };
    const slotRefs: SlotRef[] =
      demands.length === 0
        ? [
            {
              tenantId: tenant.tenantId,
              providerId: availability.provider.id,
              resourceId: "none",
              startAt: new Date(occupiedStartMs),
            },
          ]
        : demands.map((demand) => ({
            tenantId: tenant.tenantId,
            providerId: availability.provider.id,
            resourceId: demand.resource.id,
            startAt: new Date(occupiedStartMs),
          }));

    const acquired: { slot: SlotRef; token: string }[] = [];
    for (const slot of slotRefs) {
      const result = await deps.locks.acquire(slot);
      if (!result.acquired) {
        for (const held of acquired) {
          await deps.locks.release(held.slot, held.token);
        }
        return reply.code(409).send({ error: "slot-locked" });
      }
      acquired.push({ slot, token: result.token });
    }

    try {
      const price = priceBooking({
        service,
        attendees,
        extras: extras.map((extra) => ({ extra, quantity: 1 })),
      });

      const booking = await deps.bookings.createPendingBooking({
        tenantId: tenant.tenantId,
        customerId: randomUUID(), // customer registry arrives with identity tasks
        serviceId: service.id,
        providerId: availability.provider.id,
        startAt: new Date(appointmentStartMs).toISOString(),
        endAt: new Date(
          appointmentStartMs + appointmentDurationMinutes(service, extras) * MINUTE_MS,
        ).toISOString(),
        durationMinutes: appointmentDurationMinutes(service, extras),
        attendees,
        extras: extras.map((extra) => ({
          extraId: extra.id,
          quantity: 1,
          unitPriceAmount: extra.priceAmount,
          multipliedByPeople: extra.multiplyByPeople,
        })),
        totalAmount: price.totalAmount,
        currency: service.currency,
        source: "widget",
        service,
        actor: { type: "customer" },
      });

      const { cart } = await deps.carts.createCart({
        tenantId: tenant.tenantId,
        customerId: booking.customerId,
        currency: service.currency,
        allocations: [{ bookingId: booking.id, amount: price.totalAmount }],
        actor: { type: "customer" },
      });
      const hold: CheckoutHold = {
        tenantId: tenant.tenantId,
        bookingId: booking.id,
        providerId: availability.provider.id,
        occupied,
        resources: demands.map((demand) => ({
          resourceId: demand.resource.id,
          units: demand.units,
        })),
        slots: acquired,
      };
      await holds.save(cart.id, hold);

      const charged = await deps.carts.chargeCart({
        tenantId: tenant.tenantId,
        cartId: cart.id,
        actor: { type: "customer" },
      });
      if (charged.status === "failed") {
        await deps.bookings.reject(tenant.tenantId, booking.id, SYSTEM_ACTOR);
        await releaseHold(hold);
        await holds.remove(tenant.tenantId, cart.id);
        return await reply.code(402).send({ error: "payment-declined", bookingId: booking.id });
      }

      return await reply.code(201).send({
        bookingId: booking.id,
        cartId: cart.id,
        status: "pending",
        price,
      });
    } catch (error) {
      for (const held of acquired) {
        await deps.locks.release(held.slot, held.token);
      }
      throw error;
    }
  });

  app.post("/v1/public/payments/webhook", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const event = request.body as WebhookEvent & { payload: { cartId: string } };
    const outcome = await deps.webhooks.process(tenant.tenantId, "fake", event, async () => {
      const hold = await holds.find(tenant.tenantId, event.payload.cartId);
      if (hold === null) {
        return;
      }
      if (event.type === "charge.succeeded") {
        await deps.bookings.approve(tenant.tenantId, hold.bookingId, SYSTEM_ACTOR);
        await deps.occupancy.recordBookingOccupancy(
          tenant.tenantId,
          hold.providerId,
          hold.occupied,
          hold.resources,
          hold.bookingId,
        );
      } else {
        await deps.bookings.reject(tenant.tenantId, hold.bookingId, SYSTEM_ACTOR);
      }
      await releaseHold(hold);
      await holds.remove(tenant.tenantId, event.payload.cartId);
    });
    return reply.send({ outcome });
  });
}
