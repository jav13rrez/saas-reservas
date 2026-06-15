/**
 * T083 – Calendar sync worker tests.
 */

import { describe, it, expect } from "vitest";
import {
  syncCalendar,
  FakeRemoteCalendarAdapter,
  FakeLocalCalendarStore,
  type RemoteCalendarEvent,
} from "@saas-reservas/worker/jobs/calendar-sync";

function makeEvent(overrides: Partial<RemoteCalendarEvent> = {}): RemoteCalendarEvent {
  return {
    remoteId: "evt-1",
    title: "Team meeting",
    startAt: "2026-06-20T09:00:00Z",
    endAt: "2026-06-20T10:00:00Z",
    allDay: false,
    status: "confirmed",
    ...overrides,
  };
}

describe("syncCalendar", () => {
  it("upserts fetched events into the local store", async () => {
    const remote = new FakeRemoteCalendarAdapter();
    const local = new FakeLocalCalendarStore();
    remote.seed(makeEvent({ remoteId: "evt-1" }), makeEvent({ remoteId: "evt-2" }));
    const result = await syncCalendar("t1", "google", "2026-06-01T00:00:00Z", remote, local);
    expect(result.upserted).toBe(2);
    expect(local.stored.size).toBe(2);
  });

  it("counts cancelled events separately", async () => {
    const remote = new FakeRemoteCalendarAdapter();
    const local = new FakeLocalCalendarStore();
    remote.seed(
      makeEvent({ remoteId: "evt-1", status: "confirmed" }),
      makeEvent({ remoteId: "evt-2", status: "cancelled" }),
    );
    const result = await syncCalendar("t1", "google", "2026-06-01T00:00:00Z", remote, local);
    expect(result.upserted).toBe(1);
    expect(result.cancelled).toBe(1);
  });

  it("detects overlapping confirmed events as conflicts", async () => {
    const remote = new FakeRemoteCalendarAdapter();
    const local = new FakeLocalCalendarStore();
    remote.seed(
      makeEvent({
        remoteId: "evt-a",
        startAt: "2026-06-20T09:00:00Z",
        endAt: "2026-06-20T10:00:00Z",
      }),
      makeEvent({
        remoteId: "evt-b",
        startAt: "2026-06-20T09:30:00Z",
        endAt: "2026-06-20T10:30:00Z",
      }),
    );
    const result = await syncCalendar("t1", "google", "2026-06-01T00:00:00Z", remote, local);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.event1RemoteId).toBe("evt-a");
    expect(result.conflicts[0]?.event2RemoteId).toBe("evt-b");
  });

  it("does not flag non-overlapping events as conflicts", async () => {
    const remote = new FakeRemoteCalendarAdapter();
    const local = new FakeLocalCalendarStore();
    remote.seed(
      makeEvent({
        remoteId: "evt-a",
        startAt: "2026-06-20T09:00:00Z",
        endAt: "2026-06-20T10:00:00Z",
      }),
      makeEvent({
        remoteId: "evt-b",
        startAt: "2026-06-20T10:00:00Z",
        endAt: "2026-06-20T11:00:00Z",
      }),
    );
    const result = await syncCalendar("t1", "google", "2026-06-01T00:00:00Z", remote, local);
    expect(result.conflicts).toHaveLength(0);
  });

  it("skips events before the since timestamp", async () => {
    const remote = new FakeRemoteCalendarAdapter();
    const local = new FakeLocalCalendarStore();
    remote.seed(
      makeEvent({ remoteId: "old", startAt: "2026-05-01T09:00:00Z" }),
      makeEvent({ remoteId: "new", startAt: "2026-06-15T09:00:00Z" }),
    );
    const result = await syncCalendar("t1", "google", "2026-06-10T00:00:00Z", remote, local);
    expect(result.upserted).toBe(1);
    expect(local.stored.has("new")).toBe(true);
    expect(local.stored.has("old")).toBe(false);
  });

  it("does not flag all-day events as conflicts", async () => {
    const remote = new FakeRemoteCalendarAdapter();
    const local = new FakeLocalCalendarStore();
    remote.seed(
      makeEvent({ remoteId: "evt-a", allDay: true }),
      makeEvent({ remoteId: "evt-b", allDay: true }),
    );
    const result = await syncCalendar("t1", "google", "2026-06-01T00:00:00Z", remote, local);
    expect(result.conflicts).toHaveLength(0);
  });
});
