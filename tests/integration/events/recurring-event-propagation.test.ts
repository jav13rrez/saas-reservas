/**
 * T054: recurring event propagation — "this-only" edits one instance,
 * "this-and-future" propagates to current and later instances only, with
 * all-or-nothing validation and per-instance audit (spec US4 scenario 3).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";
import type { BookableEvent } from "@saas-reservas/domain/events/event";
import { InMemoryEventStore } from "@saas-reservas/api/application/events/event-store";
import { RecurringEventService } from "@saas-reservas/api/application/events/recurring-event-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";

const TENANT = "00000000-0000-4000-8000-000000000001";
const SERIES = "series-1";
const actor = SYSTEM_ACTOR;

const instance = (id: string, day: number): BookableEvent => ({
  id,
  tenantId: TENANT,
  seriesId: SERIES,
  name: "Yoga class",
  startAt: `2026-07-${String(day).padStart(2, "0")}T10:00:00.000Z`,
  endAt: `2026-07-${String(day).padStart(2, "0")}T11:00:00.000Z`,
  totalCapacity: 10,
  minCapacity: 0,
  status: "published",
});

describe("recurring event propagation", () => {
  let store: InMemoryEventStore;
  let events: InMemoryEventSink;
  let service: RecurringEventService;

  beforeEach(async () => {
    store = new InMemoryEventStore();
    events = new InMemoryEventSink();
    service = new RecurringEventService(store, events);
    await store.insertEvent(instance("evt-1", 1)); // earlier
    await store.insertEvent(instance("evt-2", 8)); // edited
    await store.insertEvent(instance("evt-3", 15)); // later
  });

  it("this-only changes exactly the edited instance", async () => {
    const updated = await service.updateWithScope({
      tenantId: TENANT,
      eventId: "evt-2",
      scope: "this-only",
      changes: { totalCapacity: 20 },
      actor,
    });
    expect(updated.map((event) => event.id)).toEqual(["evt-2"]);
    expect((await store.findEventById(TENANT, "evt-1"))?.totalCapacity).toBe(10);
    expect((await store.findEventById(TENANT, "evt-2"))?.totalCapacity).toBe(20);
    expect((await store.findEventById(TENANT, "evt-3"))?.totalCapacity).toBe(10);
  });

  it("this-and-future changes the edited instance and later ones, never earlier", async () => {
    const updated = await service.updateWithScope({
      tenantId: TENANT,
      eventId: "evt-2",
      scope: "this-and-future",
      changes: { name: "Yoga class v2", totalCapacity: 15 },
      actor,
    });
    expect(updated.map((event) => event.id).sort()).toEqual(["evt-2", "evt-3"]);
    expect((await store.findEventById(TENANT, "evt-1"))?.name).toBe("Yoga class");
    expect((await store.findEventById(TENANT, "evt-2"))?.name).toBe("Yoga class v2");
    expect((await store.findEventById(TENANT, "evt-3"))?.totalCapacity).toBe(15);

    // One audit record per touched instance, carrying the scope.
    const audits = events.audits.filter((audit) => audit.action === "event.updated");
    expect(audits.map((audit) => audit.entityId).sort()).toEqual(["evt-2", "evt-3"]);
    expect(audits.every((audit) => audit.metadata?.scope === "this-and-future")).toBe(true);
  });

  it("propagation is all-or-nothing: an invalid change writes no instance", async () => {
    await expect(
      service.updateWithScope({
        tenantId: TENANT,
        eventId: "evt-2",
        scope: "this-and-future",
        changes: { totalCapacity: 0 }, // invalid for every instance
        actor,
      }),
    ).rejects.toThrow();
    expect((await store.findEventById(TENANT, "evt-2"))?.totalCapacity).toBe(10);
    expect((await store.findEventById(TENANT, "evt-3"))?.totalCapacity).toBe(10);
    expect(events.audits).toHaveLength(0);
  });

  it("treats a non-series event with this-and-future as a single update", async () => {
    const { seriesId: _series, ...solo } = instance("evt-solo", 20);
    await store.insertEvent(solo);
    const updated = await service.updateWithScope({
      tenantId: TENANT,
      eventId: "evt-solo",
      scope: "this-and-future",
      changes: { totalCapacity: 5 },
      actor,
    });
    expect(updated.map((event) => event.id)).toEqual(["evt-solo"]);
  });
});
