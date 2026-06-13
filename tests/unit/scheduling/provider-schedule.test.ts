/**
 * T015: provider schedule resolution — weekly windows, breaks, days off,
 * special days, and time zone (including DST) handling.
 */

import { describe, expect, it } from "vitest";
import {
  InvalidScheduleError,
  resolveWorkingWindows,
  validateScheduleEntry,
  type ProviderScheduleEntry,
} from "@saas-reservas/domain/providers/provider";

const MADRID = "Europe/Madrid";

function iso(intervals: { start: number; end: number }[]): { start: string; end: string }[] {
  return intervals.map((interval) => ({
    start: new Date(interval.start).toISOString(),
    end: new Date(interval.end).toISOString(),
  }));
}

const weeklyMonday: ProviderScheduleEntry = {
  kind: "weekly",
  weekday: 1,
  startTime: "09:00",
  endTime: "17:00",
  breaks: [{ start: "13:00", end: "14:00" }],
};

describe("resolveWorkingWindows", () => {
  // 2026-06-15 is a Monday; Madrid is UTC+2 in June.
  it("resolves weekly windows in the provider time zone, minus breaks", () => {
    const windows = resolveWorkingWindows([weeklyMonday], "2026-06-15", MADRID);
    expect(iso(windows)).toEqual([
      { start: "2026-06-15T07:00:00.000Z", end: "2026-06-15T11:00:00.000Z" },
      { start: "2026-06-15T12:00:00.000Z", end: "2026-06-15T15:00:00.000Z" },
    ]);
  });

  it("returns nothing on weekdays without a schedule entry", () => {
    // 2026-06-16 is a Tuesday.
    expect(resolveWorkingWindows([weeklyMonday], "2026-06-16", MADRID)).toEqual([]);
  });

  it("removes the whole day on a day off, even when a weekly window exists", () => {
    const entries: ProviderScheduleEntry[] = [
      weeklyMonday,
      { kind: "day-off", date: "2026-06-15" },
    ];
    expect(resolveWorkingWindows(entries, "2026-06-15", MADRID)).toEqual([]);
  });

  it("lets a special day override the weekly pattern for that date only", () => {
    const entries: ProviderScheduleEntry[] = [
      weeklyMonday,
      { kind: "special-day", date: "2026-06-15", startTime: "10:00", endTime: "12:00", breaks: [] },
    ];
    expect(iso(resolveWorkingWindows(entries, "2026-06-15", MADRID))).toEqual([
      { start: "2026-06-15T08:00:00.000Z", end: "2026-06-15T10:00:00.000Z" },
    ]);
    // The following Monday falls back to the weekly pattern.
    expect(resolveWorkingWindows(entries, "2026-06-22", MADRID)).toHaveLength(2);
  });

  it("adds working time on a special day that has no weekly counterpart", () => {
    // Sunday has no weekly entry, but the tenant opens for a one-off date.
    const entries: ProviderScheduleEntry[] = [
      weeklyMonday,
      { kind: "special-day", date: "2026-06-14", startTime: "10:00", endTime: "13:00", breaks: [] },
    ];
    expect(iso(resolveWorkingWindows(entries, "2026-06-14", MADRID))).toEqual([
      { start: "2026-06-14T08:00:00.000Z", end: "2026-06-14T11:00:00.000Z" },
    ]);
  });

  it("handles the spring DST transition: same wall time, different UTC offset", () => {
    // Madrid switches to UTC+2 on 2026-03-29 (a Sunday). Use a Sunday weekly entry.
    const sunday: ProviderScheduleEntry = {
      kind: "weekly",
      weekday: 0,
      startTime: "09:00",
      endTime: "17:00",
      breaks: [],
    };
    const beforeDst = resolveWorkingWindows([sunday], "2026-03-22", MADRID);
    const afterDst = resolveWorkingWindows([sunday], "2026-03-29", MADRID);
    expect(iso(beforeDst)[0]?.start).toBe("2026-03-22T08:00:00.000Z"); // UTC+1
    expect(iso(afterDst)[0]?.start).toBe("2026-03-29T07:00:00.000Z"); // UTC+2
  });

  it("interprets the same schedule differently per provider time zone", () => {
    const madrid = resolveWorkingWindows([weeklyMonday], "2026-06-15", MADRID);
    const newYork = resolveWorkingWindows([weeklyMonday], "2026-06-15", "America/New_York");
    expect(iso(newYork)[0]?.start).toBe("2026-06-15T13:00:00.000Z"); // 09:00 EDT
    expect(newYork[0]?.start).not.toBe(madrid[0]?.start);
  });
});

describe("validateScheduleEntry", () => {
  it("rejects windows that end before they start", () => {
    expect(() => {
      validateScheduleEntry({
        kind: "weekly",
        weekday: 1,
        startTime: "17:00",
        endTime: "09:00",
        breaks: [],
      });
    }).toThrow(InvalidScheduleError);
  });

  it("rejects breaks outside the working window", () => {
    expect(() => {
      validateScheduleEntry({
        kind: "weekly",
        weekday: 1,
        startTime: "09:00",
        endTime: "17:00",
        breaks: [{ start: "08:00", end: "10:00" }],
      });
    }).toThrow(InvalidScheduleError);
  });

  it("rejects invalid weekdays and malformed dates", () => {
    expect(() => {
      validateScheduleEntry({
        kind: "weekly",
        weekday: 7,
        startTime: "09:00",
        endTime: "17:00",
        breaks: [],
      });
    }).toThrow(InvalidScheduleError);
    expect(() => {
      validateScheduleEntry({ kind: "day-off", date: "2026-02-30" });
    }).toThrow();
  });
});
