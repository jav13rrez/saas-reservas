/**
 * Cancellation and reschedule application service (T048).
 *
 * Policy first (T045), then the state machine, then money and occupancy:
 * cancel refunds the booking's subpayment and frees its occupancy; reschedule
 * validates the new slot against the availability engine, marks the old
 * booking rescheduled, creates the replacement, re-points the subpayment, and
 * swaps occupancy. Every transition is audited via BookingService.
 */

import type { Actor } from "@saas-reservas/domain/audit/events";
import type { Booking } from "@saas-reservas/domain/bookings/booking";
import { MINUTE_MS, type Interval } from "@saas-reservas/domain/scheduling/time";
import type { TenantPolicies } from "@saas-reservas/domain/tenancy/tenant";
import type { OccupancyRecorder } from "../../api/checkout-routes.js";
import type { CatalogRepository } from "../catalog/catalog-service.js";
import type { ResourceHubRepository } from "../catalog/resource-hub-service.js";
import type { AvailabilityService } from "../scheduling/availability-service.js";
import { hubCandidates } from "../scheduling/hub-resources.js";
import { evaluateChange, type ChangeAction } from "./change-policy-engine.js";
import type { BookingRepository, BookingService } from "./booking-service.js";

/** Payment side-effects of booking changes; backed by CartReconciliationService. */
export interface PaymentSettlement {
  refundBooking(
    tenantId: string,
    bookingId: string,
    actor: Actor,
  ): Promise<"refunded" | "no-payment">;
  /** Moves the subpayment of a rescheduled booking to its replacement. */
  reassignBooking(tenantId: string, fromBookingId: string, toBookingId: string): Promise<void>;
}

export class ChangeRejectedError extends Error {
  constructor(
    readonly action: ChangeAction,
    readonly reason:
      | "invalid-status"
      | "too-late"
      | "already-started"
      | "booking-not-found"
      | "slot-not-available",
  ) {
    super(`${action} rejected: ${reason}`);
    this.name = "ChangeRejectedError";
  }
}

export class BookingChangeService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly bookingService: BookingService,
    private readonly payments: PaymentSettlement,
    private readonly occupancy: OccupancyRecorder,
    private readonly availability: AvailabilityService,
    private readonly catalog: CatalogRepository,
    private readonly hub: ResourceHubRepository,
  ) {}

  async cancel(input: {
    tenantId: string;
    bookingId: string;
    policies: TenantPolicies;
    actor: Actor;
    now?: Date;
  }): Promise<{ booking: Booking; refund: "refunded" | "no-payment" }> {
    const booking = await this.requireBookingAllowing(input, "cancel");
    const canceled = await this.bookingService.cancel(input.tenantId, input.bookingId, input.actor);
    const refund = await this.payments.refundBooking(input.tenantId, input.bookingId, input.actor);
    await this.occupancy.releaseBookingOccupancy(input.tenantId, booking.id);
    return { booking: canceled, refund };
  }

  async reschedule(input: {
    tenantId: string;
    bookingId: string;
    /** New appointment start (ISO UTC) and its calendar date in the tenant TZ. */
    newStartAt: string;
    newDate: string;
    policies: TenantPolicies;
    tenantTimezone: string;
    actor: Actor;
    now?: Date;
  }): Promise<{ oldBooking: Booking; newBooking: Booking }> {
    const booking = await this.requireBookingAllowing(input, "reschedule");

    const availability = await this.availability.availability({
      tenantId: input.tenantId,
      serviceId: booking.serviceId,
      date: input.newDate,
      providerId: booking.providerId,
      tenantTimezone: input.tenantTimezone,
    });
    const offered =
      availability.ok &&
      availability.slots.some((slot) => Date.parse(slot.startAt) === Date.parse(input.newStartAt));
    if (!offered) {
      throw new ChangeRejectedError("reschedule", "slot-not-available");
    }

    const service = await this.catalog.findServiceById(input.tenantId, booking.serviceId);
    if (service === null) {
      throw new ChangeRejectedError("reschedule", "slot-not-available");
    }

    const oldBooking = await this.bookingService.reschedule(
      input.tenantId,
      input.bookingId,
      input.actor,
    );
    await this.occupancy.releaseBookingOccupancy(input.tenantId, booking.id);

    const startMs = Date.parse(input.newStartAt);
    const pending = await this.bookingService.createPendingBooking({
      tenantId: booking.tenantId,
      customerId: booking.customerId,
      serviceId: booking.serviceId,
      providerId: booking.providerId,
      startAt: new Date(startMs).toISOString(),
      endAt: new Date(startMs + booking.durationMinutes * MINUTE_MS).toISOString(),
      durationMinutes: booking.durationMinutes,
      attendees: booking.attendees,
      extras: booking.extras,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      source: booking.source,
      service,
      actor: input.actor,
    });
    // Payment is already settled on the old booking; the replacement is
    // approved directly and inherits the subpayment.
    const newBooking = await this.bookingService.approve(input.tenantId, pending.id, input.actor);
    await this.payments.reassignBooking(input.tenantId, booking.id, newBooking.id);

    const occupied: Interval = {
      start: startMs - service.bufferBeforeMinutes * MINUTE_MS,
      end: startMs + (booking.durationMinutes + service.bufferAfterMinutes) * MINUTE_MS,
    };
    // Hub allocation (ADR-0016): re-allocate one resource from the service pool
    // for the new interval, mirroring checkout. The slot was already validated.
    const allocated = await this.allocateHubResource(
      input.tenantId,
      booking.serviceId,
      booking.providerId,
      occupied,
    );
    await this.occupancy.recordBookingOccupancy(
      input.tenantId,
      booking.providerId,
      occupied,
      allocated,
      newBooking.id,
    );

    return { oldBooking, newBooking };
  }

  /**
   * Picks one eligible, location-compatible resource from the service's hub pool
   * that has a free unit over the interval. Returns `[]` when no resource serves
   * the service. The availability check already guaranteed capacity exists.
   */
  private async allocateHubResource(
    tenantId: string,
    serviceId: string,
    providerId: string,
    occupied: Interval,
  ): Promise<{ resourceId: string; units: number }[]> {
    const serving = await this.hub.listHubResourcesForService(tenantId, serviceId);
    if (serving.length === 0) {
      return [];
    }
    const candidates = hubCandidates(serving, providerId, []);
    for (const candidate of candidates) {
      const allocations = await this.catalog.listResourceAllocations(
        tenantId,
        candidate.resource.id,
        occupied,
      );
      const unitsInUse = allocations.reduce((sum, allocation) => sum + allocation.units, 0);
      if (unitsInUse + 1 <= candidate.resource.quantity) {
        return [{ resourceId: candidate.resource.id, units: 1 }];
      }
    }
    return [];
  }

  private async requireBookingAllowing(
    input: { tenantId: string; bookingId: string; policies: TenantPolicies; now?: Date },
    action: ChangeAction,
  ): Promise<Booking> {
    const booking = await this.bookings.findBookingById(input.tenantId, input.bookingId);
    if (booking === null) {
      throw new ChangeRejectedError(action, "booking-not-found");
    }
    const decision = evaluateChange({
      booking,
      policies: input.policies,
      action,
      now: input.now ?? new Date(),
    });
    if (!decision.allowed) {
      throw new ChangeRejectedError(action, decision.reason);
    }
    return booking;
  }
}
