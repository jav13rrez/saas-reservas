/**
 * T055: recurring appointment conflict strategies — exact matches schedule,
 * "omit" drops conflicting occurrences, "suggest" proposes the nearest
 * available slot on the same date.
 */

import { describe, expect, it } from "vitest";
import type { AvailableSlot } from "@saas-reservas/api/application/scheduling/availability-engine";
import {
  resolveRecurringOccurrences,
  type OccurrenceRequest,
} from "@saas-reservas/api/application/scheduling/recurrence-conflict-resolver";

const slot = (startAt: string): AvailableSlot => ({
  startAt,
  endAt: new Date(Date.parse(startAt) + 3_600_000).toISOString(),
});

// Three weekly Mondays at 10:00; on the 22nd 10:00 is taken (nearest free 12:00),
// on the 29th the provider has a day off (no slots).
const availabilityByDate: Record<string, AvailableSlot[]> = {
  "2026-06-15": [slot("2026-06-15T09:00:00.000Z"), slot("2026-06-15T10:00:00.000Z")],
  "2026-06-22": [slot("2026-06-22T08:00:00.000Z"), slot("2026-06-22T12:00:00.000Z")],
  "2026-06-29": [],
};

const requests: OccurrenceRequest[] = [
  { date: "2026-06-15", startAt: "2026-06-15T10:00:00.000Z" },
  { date: "2026-06-22", startAt: "2026-06-22T10:00:00.000Z" },
  { date: "2026-06-29", startAt: "2026-06-29T10:00:00.000Z" },
];

const availableSlots = (date: string): Promise<AvailableSlot[]> =>
  Promise.resolve(availabilityByDate[date] ?? []);

describe("recurring appointment conflicts", () => {
  it("omit: schedules exact matches and drops every conflict", async () => {
    const result = await resolveRecurringOccurrences({
      requests,
      strategy: "omit",
      availableSlots,
    });
    expect(result.occurrences.map((occurrence) => occurrence.status)).toEqual([
      "scheduled",
      "omitted",
      "omitted",
    ]);
    expect(result.scheduledCount).toBe(1);
    expect(result.conflictCount).toBe(2);
  });

  it("suggest: proposes the nearest available slot on the same date", async () => {
    const result = await resolveRecurringOccurrences({
      requests,
      strategy: "suggest",
      availableSlots,
    });
    const [first, second, third] = result.occurrences;
    expect(first?.status).toBe("scheduled");
    expect(second?.status).toBe("suggested");
    if (second?.status === "suggested") {
      // 12:00 is 2h away from the requested 10:00; 08:00 is also 2h — reduce keeps
      // the first closest found, which is 08:00. Distance ties resolve stably.
      expect(["2026-06-22T08:00:00.000Z", "2026-06-22T12:00:00.000Z"]).toContain(
        second.slot.startAt,
      );
    }
    // A day with no availability cannot be suggested: it is omitted even here.
    expect(third?.status).toBe("omitted");
  });

  it("suggests the strictly closest slot when distances differ", async () => {
    const result = await resolveRecurringOccurrences({
      requests: [{ date: "2026-06-22", startAt: "2026-06-22T11:00:00.000Z" }],
      strategy: "suggest",
      availableSlots,
    });
    const occurrence = result.occurrences[0];
    expect(occurrence?.status).toBe("suggested");
    if (occurrence?.status === "suggested") {
      expect(occurrence.slot.startAt).toBe("2026-06-22T12:00:00.000Z"); // 1h vs 3h
    }
  });
});
