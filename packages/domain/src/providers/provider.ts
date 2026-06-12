/**
 * Provider entities and working-window resolution (T020).
 *
 * A provider's availability for a calendar date comes from, in precedence order:
 * day-off entries (no work), special-day entries (override the weekly pattern),
 * then weekly entries for that weekday. Breaks are subtracted from every window.
 * All wall-clock times are interpreted in the provider's time zone (falling back
 * to the tenant's), so DST is handled per provider.
 */

import {
  parseIsoDate,
  parseTimeOfDay,
  subtractIntervals,
  wallTimeToUtcMs,
  weekdayOf,
  type Interval,
} from "../scheduling/time.js";

export type ProviderStatus = "active" | "inactive";

export type StaffPermission =
  | "manage-own-schedule"
  | "manage-own-bookings"
  | "view-customer-contact";

export interface Provider {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  status: ProviderStatus;
  /** IANA time zone; overrides the tenant default for this provider's schedule. */
  timezone: string;
  permissions: StaffPermission[];
}

export interface ScheduleBreak {
  /** "HH:mm" wall clock. */
  start: string;
  end: string;
}

interface ScheduleWindowBase {
  startTime: string;
  endTime: string;
  breaks: ScheduleBreak[];
}

export type ProviderScheduleEntry =
  | ({ kind: "weekly"; weekday: number } & ScheduleWindowBase)
  | ({ kind: "special-day"; date: string } & ScheduleWindowBase)
  | { kind: "day-off"; date: string };

export class InvalidScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidScheduleError";
  }
}

function validateWindow(entry: ScheduleWindowBase, label: string): void {
  const start = parseTimeOfDay(entry.startTime);
  const end = parseTimeOfDay(entry.endTime);
  if (end <= start) {
    throw new InvalidScheduleError(`${label}: endTime must be after startTime`);
  }
  for (const brk of entry.breaks) {
    const breakStart = parseTimeOfDay(brk.start);
    const breakEnd = parseTimeOfDay(brk.end);
    if (breakEnd <= breakStart) {
      throw new InvalidScheduleError(`${label}: break end must be after break start`);
    }
    if (breakStart < start || breakEnd > end) {
      throw new InvalidScheduleError(`${label}: breaks must fall inside the working window`);
    }
  }
}

export function validateScheduleEntry(entry: ProviderScheduleEntry): void {
  if (entry.kind === "day-off") {
    parseIsoDate(entry.date);
    return;
  }
  if (entry.kind === "weekly") {
    if (!Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6) {
      throw new InvalidScheduleError(`weekday must be 0-6, got ${String(entry.weekday)}`);
    }
    validateWindow(entry, `weekly[${String(entry.weekday)}]`);
    return;
  }
  parseIsoDate(entry.date);
  validateWindow(entry, `special-day[${entry.date}]`);
}

/**
 * Resolves the UTC working windows of a provider for one calendar date.
 * Returns half-open intervals, already net of breaks, in chronological order.
 */
export function resolveWorkingWindows(
  entries: ProviderScheduleEntry[],
  isoDate: string,
  timeZone: string,
): Interval[] {
  const date = parseIsoDate(isoDate);

  if (entries.some((entry) => entry.kind === "day-off" && entry.date === isoDate)) {
    return [];
  }

  const specials = entries.filter(
    (entry): entry is Extract<ProviderScheduleEntry, { kind: "special-day" }> =>
      entry.kind === "special-day" && entry.date === isoDate,
  );
  const weekday = weekdayOf(date);
  const applicable: (ScheduleWindowBase & { kind: string })[] =
    specials.length > 0
      ? specials
      : entries.filter(
          (entry): entry is Extract<ProviderScheduleEntry, { kind: "weekly" }> =>
            entry.kind === "weekly" && entry.weekday === weekday,
        );

  const windows: Interval[] = [];
  for (const entry of applicable) {
    const window: Interval = {
      start: wallTimeToUtcMs(date, parseTimeOfDay(entry.startTime), timeZone),
      end: wallTimeToUtcMs(date, parseTimeOfDay(entry.endTime), timeZone),
    };
    const holes: Interval[] = entry.breaks.map((brk) => ({
      start: wallTimeToUtcMs(date, parseTimeOfDay(brk.start), timeZone),
      end: wallTimeToUtcMs(date, parseTimeOfDay(brk.end), timeZone),
    }));
    windows.push(...subtractIntervals(window, holes));
  }
  return windows.sort((a, b) => a.start - b.start);
}
