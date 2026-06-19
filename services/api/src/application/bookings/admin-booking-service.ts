/**
 * Admin booking service (ADR-0018 Phase 3): staff "book on behalf" without the
 * public checkout/payment path (decided: no-charge staff booking).
 *
 * Reuses the availability engine and occupancy recorder so an admin booking is
 * subject to the same correctness guarantees as a public one (constitution
 * principle II): the requested slot must be currently offered, a serving hub
 * resource with a free unit is allocated, the booking is created and approved
 * through the booking state machine, and occupancy is recorded so the slot
 * disappears from availability. No cart, gateway, or webhook is involved.
 *
 * Concurrency note: unlike checkout this path takes no Redis slot lock — an
 * admin booking is a single trusted synchronous action and occupancy is recorded
 * immediately. Two simultaneous admin bookings for the same slot is an accepted
 * v1 risk (TECH_DEBT), far smaller than the public-checkout window it omits.
 */

import type { Actor } from "@saas-reservas/domain/audit/events";
import type { Booking } from "@saas-reservas/domain/bookings/booking";
import {
  appointmentDurationMinutes,
  totalDurationMinutes,
} from "@saas-reservas/domain/catalog/service";
import { MINUTE_MS, type Interval } from "@saas-reservas/domain/scheduling/time";
import type { CatalogRepository } from "../catalog/catalog-service.js";
import type { ResourceHubRepository } from "../catalog/resource-hub-service.js";
import type { OccupancyRecorder } from "../../api/checkout-routes.js";
import { hubCandidates } from "../scheduling/hub-resources.js";
import type { AvailabilityService } from "../scheduling/availability-service.js";
import type { BookingService } from "./booking-service.js";

export interface AdminBookingReadRepository {
  /** All bookings for a tenant (admin read model). */
  listBookings(tenantId: string): Promise<Booking[]>;
}

export type AdminBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "service-not-found" | "provider-required" | "slot-not-available" };

export interface AdminBookingDeps {
  availability: AvailabilityService;
  catalog: CatalogRepository;
  hub: ResourceHubRepository;
  bookings: BookingService;
  reads: AdminBookingReadRepository;
  occupancy: OccupancyRecorder;
  tenantTimezone(tenantId: string): Promise<string>;
}

export interface CreateAdminBookingInput {
  tenantId: string;
  serviceId: string;
  providerId: string;
  customerId: string;
  /** Appointment start, ISO-8601 UTC; must match a currently offered slot. */
  startAt: string;
  /** Calendar date (YYYY-MM-DD) the slot belongs to, for the availability query. */
  date: string;
  actor: Actor;
}

export class AdminBookingService {
  constructor(private readonly deps: AdminBookingDeps) {}

  listBookings(tenantId: string): Promise<Booking[]> {
    return this.deps.reads.listBookings(tenantId);
  }

  async createBooking(input: CreateAdminBookingInput): Promise<AdminBookingResult> {
    const availability = await this.deps.availability.availability({
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      date: input.date,
      providerId: input.providerId,
      tenantTimezone: await this.deps.tenantTimezone(input.tenantId),
    });
    if (!availability.ok) {
      const reason =
        availability.reason === "service-not-found"
          ? "service-not-found"
          : availability.reason === "provider-required"
            ? "provider-required"
            : "slot-not-available";
      return { ok: false, reason };
    }
    const offered = availability.slots.find(
      (slot) => Date.parse(slot.startAt) === Date.parse(input.startAt),
    );
    if (offered === undefined) {
      return { ok: false, reason: "slot-not-available" };
    }

    const service = await this.deps.catalog.findServiceById(input.tenantId, input.serviceId);
    if (service === null) {
      return { ok: false, reason: "service-not-found" };
    }

    const appointmentStartMs = Date.parse(input.startAt);
    const occupiedStartMs = appointmentStartMs - service.bufferBeforeMinutes * MINUTE_MS;
    const occupied: Interval = {
      start: occupiedStartMs,
      end: occupiedStartMs + totalDurationMinutes(service, []) * MINUTE_MS,
    };

    // Hub allocation (ADR-0016): pick one eligible, location-compatible resource
    // with a free unit over the occupied interval. No serving resource => no
    // resource demand (provider-level slot only).
    const serving = await this.deps.hub.listHubResourcesForService(input.tenantId, input.serviceId);
    const providerLocationIds =
      serving.length > 0
        ? await this.deps.catalog.listProviderLocationIds(input.tenantId, availability.provider.id)
        : [];
    const candidates =
      serving.length > 0
        ? hubCandidates(serving, availability.provider.id, providerLocationIds)
        : [];

    let allocatedResource: { resourceId: string; units: number } | null = null;
    for (const candidate of candidates) {
      const allocations = await this.deps.catalog.listResourceAllocations(
        input.tenantId,
        candidate.resource.id,
        occupied,
      );
      const unitsInUse = allocations.reduce((sum, allocation) => sum + allocation.units, 0);
      if (unitsInUse + 1 <= candidate.resource.quantity) {
        allocatedResource = { resourceId: candidate.resource.id, units: 1 };
        break;
      }
    }
    if (serving.length > 0 && allocatedResource === null) {
      return { ok: false, reason: "slot-not-available" };
    }

    const durationMinutes = appointmentDurationMinutes(service, []);
    const pending = await this.deps.bookings.createPendingBooking({
      tenantId: input.tenantId,
      customerId: input.customerId,
      serviceId: service.id,
      providerId: availability.provider.id,
      startAt: new Date(appointmentStartMs).toISOString(),
      endAt: new Date(appointmentStartMs + durationMinutes * MINUTE_MS).toISOString(),
      durationMinutes,
      attendees: 1,
      extras: [],
      totalAmount: service.priceAmount,
      currency: service.currency,
      source: "admin",
      service,
      actor: input.actor,
    });
    const approved = await this.deps.bookings.approve(input.tenantId, pending.id, input.actor);
    await this.deps.occupancy.recordBookingOccupancy(
      input.tenantId,
      availability.provider.id,
      occupied,
      allocatedResource === null ? [] : [allocatedResource],
      approved.id,
    );
    return { ok: true, booking: approved };
  }

  /** Cancel an admin booking: state transition + free its occupancy. */
  async cancelBooking(input: {
    tenantId: string;
    bookingId: string;
    actor: Actor;
  }): Promise<Booking> {
    const canceled = await this.deps.bookings.cancel(input.tenantId, input.bookingId, input.actor);
    await this.deps.occupancy.releaseBookingOccupancy(input.tenantId, input.bookingId);
    return canceled;
  }
}
