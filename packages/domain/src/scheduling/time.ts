/**
 * Time primitives for the scheduling domain.
 *
 * All instants are epoch milliseconds UTC; wall-clock times only exist at the
 * edge, paired with an IANA time zone. Conversion uses Intl so DST transitions
 * are handled without a date library dependency.
 */

/** Half-open interval [start, end) in epoch milliseconds UTC. */
export interface Interval {
  start: number;
  end: number;
}

export const MINUTE_MS = 60_000;

export class InvalidTimeFormatError extends Error {
  constructor(value: string, expected: string) {
    super(`Invalid time value ${JSON.stringify(value)}; expected ${expected}`);
    this.name = "InvalidTimeFormatError";
  }
}

/** Parses "HH:mm" (00:00-23:59) into minutes since midnight. */
export function parseTimeOfDay(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (match === null) {
    throw new InvalidTimeFormatError(value, '"HH:mm"');
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export interface IsoDate {
  year: number;
  month: number;
  day: number;
}

/** Parses "YYYY-MM-DD" into calendar components, validating the date exists. */
export function parseIsoDate(value: string): IsoDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    throw new InvalidTimeFormatError(value, '"YYYY-MM-DD"');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new InvalidTimeFormatError(value, "an existing calendar date");
  }
  return { year, month, day };
}

/** Weekday of a calendar date, 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(date: IsoDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/** Offset (wall minus UTC, in ms) of `timeZone` at the given UTC instant. */
function timeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(utcMs)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  const wallAsUtc = Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Converts a wall-clock time (minutes since midnight on a calendar date, in an
 * IANA time zone) to a UTC instant in epoch ms. Two-pass offset resolution
 * handles DST: nonexistent local times resolve to the post-transition instant.
 */
export function wallTimeToUtcMs(
  date: IsoDate,
  minutesSinceMidnight: number,
  timeZone: string,
): number {
  let utcGuess = Date.UTC(date.year, date.month - 1, date.day) + minutesSinceMidnight * MINUTE_MS;
  for (let i = 0; i < 2; i += 1) {
    const offset = timeZoneOffsetMs(utcGuess, timeZone);
    utcGuess =
      Date.UTC(date.year, date.month - 1, date.day) + minutesSinceMidnight * MINUTE_MS - offset;
  }
  return utcGuess;
}

export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Subtracts `holes` from `window`, returning the remaining sub-intervals in order. */
export function subtractIntervals(window: Interval, holes: Interval[]): Interval[] {
  const sorted = [...holes]
    .filter((hole) => intervalsOverlap(window, hole))
    .sort((a, b) => a.start - b.start);
  const result: Interval[] = [];
  let cursor = window.start;
  for (const hole of sorted) {
    if (hole.start > cursor) {
      result.push({ start: cursor, end: Math.min(hole.start, window.end) });
    }
    cursor = Math.max(cursor, hole.end);
    if (cursor >= window.end) {
      return result;
    }
  }
  if (cursor < window.end) {
    result.push({ start: cursor, end: window.end });
  }
  return result;
}
