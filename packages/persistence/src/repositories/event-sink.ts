/**
 * Drizzle adapter for the EventSink port: persists the domain event (outbox,
 * ADR-0004) and the audit record in one tenant-scoped transaction.
 */

import type { AuditRecord, DomainEvent } from "@saas-reservas/domain/audit/events";
import type { TenantDb } from "../db.js";
import { auditRecords, domainEvents } from "../schema.js";

export class DrizzleEventSink {
  constructor(private readonly db: TenantDb) {}

  async record(event: DomainEvent, audit: AuditRecord): Promise<void> {
    await this.db.withTenant(event.tenantId, async (tx) => {
      await tx.insert(domainEvents).values({
        eventId: event.eventId,
        tenantId: event.tenantId,
        type: event.type,
        occurredAt: new Date(event.occurredAt),
        actor: event.actor,
        payload: event.payload ?? {},
        correlationId: event.correlationId ?? null,
      });
      await tx.insert(auditRecords).values({
        auditId: audit.auditId,
        tenantId: audit.tenantId,
        eventId: audit.eventId,
        action: audit.action,
        entityType: audit.entityType,
        entityId: audit.entityId,
        actor: audit.actor,
        occurredAt: new Date(audit.occurredAt),
        metadata: audit.metadata ?? null,
      });
    });
  }
}
