/**
 * Availability engine v1 (T024).
 *
 * Pure function over domain data: provider working windows (weekly schedule,
 * breaks, days off, special days, time zones), service duration + extras +
 * buffers, existing provider busy intervals, and shared resource allocations.
 * No I/O here — repositories assemble the input, delivery channels serialize
 * the output (constitution principle III).
 */

import {
  appointmentDurationMinutes,
  totalDurationMinutes,
  type Extra,
  type Service,
} from "@saas-reservas/domain/catalog/service";
import {
  resolveWorkingWindows,
  type ProviderScheduleEntry,
} from "@saas-reservas/domain/providers/provider";
import { intervalsOverlap, MINUTE_MS, type Interval } from "@saas-reservas/domain/scheduling/time";

/** An existing allocation consuming `units` of a resource during an interval. */
export interface ResourceAllocation extends Interval {
  units: number;
}

/** Demand of the queried service on one shared resource. */
export interface ResourceDemand {
  resourceId: string;
  /** Total identical units the resource has. */
  resourceQuantity: number;
  /** Units one booking of the queried service consumes. */
  unitsRequired: number;
  /** Existing allocations from any service, including provisional checkout holds. */
  existingAllocations: ResourceAllocation[];
}

export interface AvailabilityInput {
  /** Calendar date "YYYY-MM-DD" in the scheduling time zone. */
  date: string;
  /** Provider time zone (falls back to tenant default upstream). */
  timezone: string;
  service: Service;
  selectedExtras: Extra[];
  scheduleEntries: ProviderScheduleEntry[];
  /** Existing bookings of this provider as UTC intervals including their buffers. */
  providerBusy: Interval[];
  resources: ResourceDemand[];
  /**
   * Resources the selected provider is eligible to use (model B). When set and
   * non-empty, the provider may only use these resources; if the service
   * demands a resource the provider is not eligible for, no slots are offered.
   * Omit (or pass empty) to treat the provider as unconstrained.
   */
  providerEligibleResourceIds?: string[];
  /** Candidate step; defaults to the customer-facing appointment duration. */
  slotStepMinutes?: number;
}

/** Customer-facing slot: appointment start/end, buffers excluded. */
export interface AvailableSlot {
  startAt: string;
  endAt: string;
}

function resourcesAvailable(occupied: Interval, demands: ResourceDemand[]): boolean {
  return demands.every((demand) => {
    const unitsInUse = demand.existingAllocations
      .filter((allocation) => intervalsOverlap(occupied, allocation))
      .reduce((sum, allocation) => sum + allocation.units, 0);
    return unitsInUse + demand.unitsRequired <= demand.resourceQuantity;
  });
}

export function computeAvailableSlots(input: AvailabilityInput): AvailableSlot[] {
  // Model B: a provider constrained by eligibility cannot serve a service that
  // demands a resource they are not eligible for, so it has zero availability.
  const eligible = input.providerEligibleResourceIds;
  if (eligible !== undefined && eligible.length > 0) {
    const allowed = new Set(eligible);
    if (!input.resources.every((demand) => allowed.has(demand.resourceId))) {
      return [];
    }
  }

  const windows = resolveWorkingWindows(input.scheduleEntries, input.date, input.timezone);
  if (windows.length === 0) {
    return [];
  }

  const totalMs = totalDurationMinutes(input.service, input.selectedExtras) * MINUTE_MS;
  const appointmentMs = appointmentDurationMinutes(input.service, input.selectedExtras) * MINUTE_MS;
  const bufferBeforeMs = input.service.bufferBeforeMinutes * MINUTE_MS;
  const stepMs =
    (input.slotStepMinutes ?? appointmentDurationMinutes(input.service, input.selectedExtras)) *
    MINUTE_MS;
  if (stepMs <= 0) {
    return [];
  }

  const slots: AvailableSlot[] = [];
  for (const window of windows) {
    // The occupied interval (buffers included) must fit inside the working window.
    for (
      let occupiedStart = window.start;
      occupiedStart + totalMs <= window.end;
      occupiedStart += stepMs
    ) {
      const occupied: Interval = { start: occupiedStart, end: occupiedStart + totalMs };
      const providerFree = !input.providerBusy.some((busy) => intervalsOverlap(occupied, busy));
      if (providerFree && resourcesAvailable(occupied, input.resources)) {
        const appointmentStart = occupiedStart + bufferBeforeMs;
        slots.push({
          startAt: new Date(appointmentStart).toISOString(),
          endAt: new Date(appointmentStart + appointmentMs).toISOString(),
        });
      }
    }
  }
  return slots;
}
