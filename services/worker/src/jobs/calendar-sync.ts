/**
 * Calendar sync worker (T083).
 *
 * Pulls remote calendar events for a tenant/provider pair and upserts them
 * into the local calendar mapping store. Detects conflicts (double-bookings)
 * and records them for operator review. Designed to run inside runJob for
 * idempotency and retry guarantees.
 */

// ---------------------------------------------------------------------------
// Remote calendar event
// ---------------------------------------------------------------------------

export interface RemoteCalendarEvent {
  remoteId: string;
  title: string;
  /** ISO datetime string */
  startAt: string;
  /** ISO datetime string */
  endAt: string;
  allDay: boolean;
  status: "confirmed" | "tentative" | "cancelled";
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

export interface RemoteCalendarAdapter {
  listEvents(tenantId: string, provider: string, since: string): Promise<RemoteCalendarEvent[]>;
}

export interface LocalCalendarStore {
  upsert(tenantId: string, provider: string, event: RemoteCalendarEvent): Promise<void>;
  listInRange(tenantId: string, startAt: string, endAt: string): Promise<RemoteCalendarEvent[]>;
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

export interface CalendarConflict {
  event1RemoteId: string;
  event2RemoteId: string;
  overlapStartAt: string;
  overlapEndAt: string;
}

function detectConflicts(events: RemoteCalendarEvent[]): CalendarConflict[] {
  const confirmed = events.filter((e) => e.status === "confirmed" && !e.allDay);
  const conflicts: CalendarConflict[] = [];

  for (let i = 0; i < confirmed.length; i++) {
    for (let j = i + 1; j < confirmed.length; j++) {
      const a = confirmed[i];
      const b = confirmed[j];
      if (a === undefined || b === undefined) continue;

      const overlapStart = a.startAt > b.startAt ? a.startAt : b.startAt;
      const overlapEnd = a.endAt < b.endAt ? a.endAt : b.endAt;

      if (overlapStart < overlapEnd) {
        conflicts.push({
          event1RemoteId: a.remoteId,
          event2RemoteId: b.remoteId,
          overlapStartAt: overlapStart,
          overlapEndAt: overlapEnd,
        });
      }
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Sync result
// ---------------------------------------------------------------------------

export interface CalendarSyncResult {
  tenantId: string;
  provider: string;
  upserted: number;
  cancelled: number;
  conflicts: CalendarConflict[];
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

export async function syncCalendar(
  tenantId: string,
  provider: string,
  since: string,
  remoteAdapter: RemoteCalendarAdapter,
  localStore: LocalCalendarStore,
): Promise<CalendarSyncResult> {
  const events = await remoteAdapter.listEvents(tenantId, provider, since);

  let upserted = 0;
  let cancelled = 0;

  for (const event of events) {
    await localStore.upsert(tenantId, provider, event);
    if (event.status === "cancelled") {
      cancelled++;
    } else {
      upserted++;
    }
  }

  const activeEvents = events.filter((e) => e.status !== "cancelled");
  const conflicts = detectConflicts(activeEvents);

  return { tenantId, provider, upserted, cancelled, conflicts };
}

// ---------------------------------------------------------------------------
// Fakes for tests
// ---------------------------------------------------------------------------

export class FakeRemoteCalendarAdapter implements RemoteCalendarAdapter {
  private readonly events: RemoteCalendarEvent[] = [];

  seed(...events: RemoteCalendarEvent[]): void {
    this.events.push(...events);
  }

  listEvents(_tenantId: string, _provider: string, since: string): Promise<RemoteCalendarEvent[]> {
    return Promise.resolve(this.events.filter((e) => e.startAt >= since));
  }
}

export class FakeLocalCalendarStore implements LocalCalendarStore {
  readonly stored = new Map<string, RemoteCalendarEvent>();

  upsert(_tenantId: string, _provider: string, event: RemoteCalendarEvent): Promise<void> {
    this.stored.set(event.remoteId, event);
    return Promise.resolve();
  }

  listInRange(_tenantId: string, startAt: string, endAt: string): Promise<RemoteCalendarEvent[]> {
    return Promise.resolve(
      [...this.stored.values()].filter((e) => e.startAt >= startAt && e.endAt <= endAt),
    );
  }
}
