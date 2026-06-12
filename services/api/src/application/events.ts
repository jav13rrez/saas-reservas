/**
 * Event recording port for application services (constitution principle V).
 * The persistence adapter must store the domain event and audit record in the
 * same transaction as the state change (outbox pattern, ADR-0004).
 */

import type { AuditRecord, DomainEvent } from "@saas-reservas/domain/audit/events";

export interface EventSink {
  record(event: DomainEvent, audit: AuditRecord): Promise<void>;
}

/** Collects events in memory; used by tests and the in-memory dev store. */
export class InMemoryEventSink implements EventSink {
  readonly events: DomainEvent[] = [];
  readonly audits: AuditRecord[] = [];

  record(event: DomainEvent, audit: AuditRecord): Promise<void> {
    this.events.push(event);
    this.audits.push(audit);
    return Promise.resolve();
  }
}
