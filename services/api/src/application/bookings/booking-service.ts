/**
 * Booking application service (T035): pending creation and deterministic
 * transitions (approve, reject, expire, cancel), each emitting a domain event
 * and audit record. Availability/lock validation happens at checkout before a
 * pending booking is created; approval requires payment state upstream
 * (constitution principle II).
 */

import { randomUUID } from "node:crypto";
import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import {
  transitionBooking,
  transitionEventType,
  type Booking,
  type BookingStatus,
} from "@saas-reservas/domain/bookings/booking";
import { assertAttendeesWithinCapacity, type Service } from "@saas-reservas/domain/catalog/service";
import type { EventSink } from "../events.js";

export interface BookingRepository {
  insertBooking(booking: Booking): Promise<void>;
  updateBooking(booking: Booking): Promise<void>;
  findBookingById(tenantId: string, bookingId: string): Promise<Booking | null>;
  listBookingsForCustomer(tenantId: string, customerId: string): Promise<Booking[]>;
  listBookingsForProvider(tenantId: string, providerId: string): Promise<Booking[]>;
}

export class BookingNotFoundError extends Error {
  constructor(bookingId: string) {
    super(`booking ${bookingId} not found`);
    this.name = "BookingNotFoundError";
  }
}

export type CreatePendingBookingInput = Omit<Booking, "id" | "status"> & {
  service: Service;
  actor: Actor;
};

export class BookingService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly events: EventSink,
  ) {}

  async createPendingBooking(input: CreatePendingBookingInput): Promise<Booking> {
    assertAttendeesWithinCapacity(input.service, input.attendees);
    const { service: _service, actor, ...fields } = input;
    const booking: Booking = { ...fields, id: randomUUID(), status: "pending" };
    await this.bookings.insertBooking(booking);
    await this.recordTransition(booking, "booking.created", actor, {
      serviceId: booking.serviceId,
      providerId: booking.providerId,
      startAt: booking.startAt,
    });
    return booking;
  }

  approve(tenantId: string, bookingId: string, actor: Actor): Promise<Booking> {
    return this.transition(tenantId, bookingId, "approved", actor);
  }

  reject(tenantId: string, bookingId: string, actor: Actor): Promise<Booking> {
    return this.transition(tenantId, bookingId, "rejected", actor);
  }

  expire(tenantId: string, bookingId: string, actor: Actor): Promise<Booking> {
    return this.transition(tenantId, bookingId, "expired", actor);
  }

  cancel(tenantId: string, bookingId: string, actor: Actor): Promise<Booking> {
    return this.transition(tenantId, bookingId, "canceled", actor);
  }

  reschedule(tenantId: string, bookingId: string, actor: Actor): Promise<Booking> {
    return this.transition(tenantId, bookingId, "rescheduled", actor);
  }

  private async transition(
    tenantId: string,
    bookingId: string,
    to: BookingStatus,
    actor: Actor,
  ): Promise<Booking> {
    const booking = await this.bookings.findBookingById(tenantId, bookingId);
    if (booking === null) {
      throw new BookingNotFoundError(bookingId);
    }
    const updated = transitionBooking(booking, to);
    await this.bookings.updateBooking(updated);
    await this.recordTransition(updated, transitionEventType(to), actor, {
      from: booking.status,
    });
    return updated;
  }

  private async recordTransition(
    booking: Booking,
    eventType: string,
    actor: Actor,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const event = createDomainEvent({
      tenantId: booking.tenantId,
      type: eventType,
      actor,
      payload: { bookingId: booking.id, status: booking.status },
    });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action: eventType,
        entityType: "booking",
        entityId: booking.id,
        ...(metadata ? { metadata } : {}),
      }),
    );
  }
}
