/**
 * Recurring appointment conflict resolver (T059).
 *
 * A recurring appointment expands into desired occurrences; some collide with
 * existing bookings or fall outside working hours. Strategies (Amelia
 * behavior): "omit" drops conflicting occurrences, "suggest" proposes the
 * nearest available slot on the same date. Pure over an injected availability
 * lookup; booking the resolved occurrences goes through the normal checkout.
 */

import type { AvailableSlot } from "./availability-engine.js";

export type ConflictStrategy = "omit" | "suggest";

export interface OccurrenceRequest {
  /** Calendar date of the occurrence, "YYYY-MM-DD" in the scheduling TZ. */
  date: string;
  /** Desired appointment start, ISO-8601 UTC. */
  startAt: string;
}

export type ResolvedOccurrence =
  | { request: OccurrenceRequest; status: "scheduled"; slot: AvailableSlot }
  | { request: OccurrenceRequest; status: "suggested"; slot: AvailableSlot }
  | { request: OccurrenceRequest; status: "omitted" };

export interface RecurrenceResolution {
  occurrences: ResolvedOccurrence[];
  scheduledCount: number;
  conflictCount: number;
}

export async function resolveRecurringOccurrences(input: {
  requests: OccurrenceRequest[];
  strategy: ConflictStrategy;
  /** Availability for one date, e.g. AvailabilityService bound to a service/provider. */
  availableSlots(date: string): Promise<AvailableSlot[]>;
}): Promise<RecurrenceResolution> {
  const occurrences: ResolvedOccurrence[] = [];

  for (const request of input.requests) {
    const slots = await input.availableSlots(request.date);
    const requestedMs = Date.parse(request.startAt);
    const exact = slots.find((slot) => Date.parse(slot.startAt) === requestedMs);
    if (exact !== undefined) {
      occurrences.push({ request, status: "scheduled", slot: exact });
      continue;
    }
    if (input.strategy === "omit" || slots.length === 0) {
      occurrences.push({ request, status: "omitted" });
      continue;
    }
    // Suggest the slot closest to the requested time on the same date.
    const nearest = slots.reduce((best, slot) =>
      Math.abs(Date.parse(slot.startAt) - requestedMs) <
      Math.abs(Date.parse(best.startAt) - requestedMs)
        ? slot
        : best,
    );
    occurrences.push({ request, status: "suggested", slot: nearest });
  }

  return {
    occurrences,
    scheduledCount: occurrences.filter((occurrence) => occurrence.status === "scheduled").length,
    conflictCount: occurrences.filter((occurrence) => occurrence.status !== "scheduled").length,
  };
}
