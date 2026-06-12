/**
 * Recurring event propagation (T060, spec US4 scenario 3): editing an instance
 * with scope "this-only" changes that instance alone; "this-and-future"
 * propagates the change to every instance of the series starting at or after
 * the edited one. Earlier instances are never touched. Each updated instance
 * is audited; recurring instances remain independent records (data-model.md).
 */

import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import { validateEvent, type BookableEvent } from "@saas-reservas/domain/events/event";
import type { EventSink } from "../events.js";
import type { EventStore } from "./event-store.js";

export type RecurrenceScope = "this-only" | "this-and-future";

/** Fields an admin may edit across a series. Times stay per-instance. */
export type SeriesChanges = Partial<
  Pick<BookableEvent, "name" | "totalCapacity" | "minCapacity" | "status">
>;

export class EventNotFoundError extends Error {
  constructor(eventId: string) {
    super(`event ${eventId} not found`);
    this.name = "EventNotFoundError";
  }
}

export class RecurringEventService {
  constructor(
    private readonly store: EventStore,
    private readonly events: EventSink,
  ) {}

  async updateWithScope(input: {
    tenantId: string;
    eventId: string;
    scope: RecurrenceScope;
    changes: SeriesChanges;
    actor: Actor;
  }): Promise<BookableEvent[]> {
    const event = await this.store.findEventById(input.tenantId, input.eventId);
    if (event === null) {
      throw new EventNotFoundError(input.eventId);
    }

    let targets: BookableEvent[];
    if (input.scope === "this-only" || event.seriesId === undefined) {
      targets = [event];
    } else {
      const series = await this.store.listEventsBySeries(input.tenantId, event.seriesId);
      const editedStart = Date.parse(event.startAt);
      targets = series.filter((instance) => Date.parse(instance.startAt) >= editedStart);
    }

    // Validate every target before writing any, so propagation is all-or-nothing.
    const updated = targets.map((instance) => {
      const next: BookableEvent = { ...instance, ...input.changes };
      validateEvent(next);
      return next;
    });

    const results: BookableEvent[] = [];
    for (const instance of updated) {
      await this.store.updateEvent(instance);
      const domainEvent = createDomainEvent({
        tenantId: input.tenantId,
        type: "event.updated",
        actor: input.actor,
        payload: { eventId: instance.id, scope: input.scope },
      });
      await this.events.record(
        domainEvent,
        auditRecordFromEvent(domainEvent, {
          action: "event.updated",
          entityType: "event",
          entityId: instance.id,
          metadata: { scope: input.scope, editedFrom: input.eventId },
        }),
      );
      results.push(instance);
    }
    return results;
  }
}
