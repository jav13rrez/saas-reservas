/**
 * Domain event and audit record primitives (constitution principle V).
 *
 * Every state transition that matters to a tenant or customer emits a domain
 * event and an audit record. Events are persisted in the same transaction as the
 * state change (outbox pattern, see ADR-0004) and dispatched to workers
 * afterwards; audit records are append-only.
 */

import { randomUUID } from "node:crypto";

export type ActorType = "platform" | "staff" | "customer" | "system";

export interface Actor {
  type: ActorType;
  /** Platform/staff/customer identifier; omitted for autonomous system actions. */
  id?: string;
}

export const SYSTEM_ACTOR: Actor = { type: "system" };

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  /** Globally unique, used for idempotent dispatch and audit linkage. */
  eventId: string;
  tenantId: string;
  type: TType;
  /** ISO-8601 UTC instant. */
  occurredAt: string;
  actor: Actor;
  payload: TPayload;
  /** Groups events caused by one request/job/webhook for tracing. */
  correlationId?: string;
}

export interface CreateDomainEventInput<TType extends string, TPayload> {
  tenantId: string;
  type: TType;
  actor: Actor;
  payload: TPayload;
  correlationId?: string;
  /** Override for deterministic tests; defaults to now. */
  occurredAt?: Date;
}

export function createDomainEvent<TType extends string, TPayload>(
  input: CreateDomainEventInput<TType, TPayload>,
): DomainEvent<TType, TPayload> {
  const event: DomainEvent<TType, TPayload> = {
    eventId: randomUUID(),
    tenantId: input.tenantId,
    type: input.type,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    actor: input.actor,
    payload: input.payload,
  };
  if (input.correlationId !== undefined) {
    event.correlationId = input.correlationId;
  }
  return event;
}

/**
 * Append-only audit record. `eventId` links back to the domain event emitted by
 * the same transition, so audit trails and event streams reconcile exactly.
 */
export interface AuditRecord {
  auditId: string;
  tenantId: string;
  eventId: string;
  /** Verb in past tense, e.g. "booking.approved", "payment.refunded". */
  action: string;
  entityType: string;
  entityId: string;
  actor: Actor;
  occurredAt: string;
  /** Small, non-sensitive context (never credentials or raw personal data). */
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AuditDetails {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export function auditRecordFromEvent(event: DomainEvent, details: AuditDetails): AuditRecord {
  const record: AuditRecord = {
    auditId: randomUUID(),
    tenantId: event.tenantId,
    eventId: event.eventId,
    action: details.action,
    entityType: details.entityType,
    entityId: details.entityId,
    actor: event.actor,
    occurredAt: event.occurredAt,
  };
  if (details.metadata !== undefined) {
    record.metadata = details.metadata;
  }
  return record;
}
