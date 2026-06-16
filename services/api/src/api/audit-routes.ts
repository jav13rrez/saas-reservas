/**
 * Audit log search API (T078).
 *
 * Provides a paginated search endpoint over the tenant-scoped audit log.
 * Supports filtering by actor, event type, and time range. All queries are
 * scoped to the requesting tenant — cross-tenant access is structurally
 * impossible because the tenantId is taken from the request context header,
 * not from the query string.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// ---------------------------------------------------------------------------
// Audit log domain types
// ---------------------------------------------------------------------------

export type AuditEventType =
  | "booking.created"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "payment.captured"
  | "payment.refunded"
  | "provider.created"
  | "provider.updated"
  | "provider.deleted"
  | "service.created"
  | "service.updated"
  | "service.deleted"
  | "tenant.plan_changed"
  | "credential.rotated"
  | "gdpr.export_requested"
  | "gdpr.anonymized"
  | "webhook.subscription_created"
  | "webhook.subscription_deleted";

export type ActorType = "customer" | "provider" | "staff" | "system";

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  eventType: AuditEventType;
  actorType: ActorType;
  actorId: string;
  resourceId?: string | undefined;
  resourceType?: string | undefined;
  occurredAt: string;
  meta?: Record<string, string> | undefined;
}

// ---------------------------------------------------------------------------
// Repository port
// ---------------------------------------------------------------------------

export interface AuditLogSearchParams {
  tenantId: string;
  actorId?: string | undefined;
  eventType?: AuditEventType | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  limit: number;
  offset: number;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogRepository {
  search(params: AuditLogSearchParams): Promise<AuditLogPage>;
  append(entry: AuditLogEntry): Promise<void>;
}

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export interface AuditRouteDeps {
  auditLog: AuditLogRepository;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

interface AuditSearchQuery {
  actorId?: string;
  eventType?: string;
  fromDate?: string;
  toDate?: string;
  limit?: string;
  offset?: string;
}

export function registerAuditRoutes(app: FastifyInstance, deps: AuditRouteDeps): void {
  app.get(
    "/audit/events",
    async (
      request: FastifyRequest<{ Querystring: AuditSearchQuery }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const tenantId = request.headers["x-tenant-id"];
      if (typeof tenantId !== "string" || tenantId.length === 0) {
        await reply.code(400).send({ error: "x-tenant-id header required" });
        return;
      }

      const limit = Math.min(Number(request.query.limit ?? "50"), 200);
      const offset = Number(request.query.offset ?? "0");

      if (!Number.isFinite(limit) || !Number.isFinite(offset)) {
        await reply.code(400).send({ error: "limit and offset must be integers" });
        return;
      }

      const { actorId, eventType, fromDate, toDate } = request.query;

      const page = await deps.auditLog.search({
        tenantId,
        actorId,
        eventType: eventType as AuditEventType | undefined,
        fromDate,
        toDate,
        limit,
        offset,
      });

      await reply.send(page);
    },
  );
}

// ---------------------------------------------------------------------------
// In-memory implementation for tests and dev seeds
// ---------------------------------------------------------------------------

export class InMemoryAuditLogRepository implements AuditLogRepository {
  readonly entries: AuditLogEntry[] = [];

  append(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }

  search(params: AuditLogSearchParams): Promise<AuditLogPage> {
    let items = this.entries.filter((e) => e.tenantId === params.tenantId);

    if (params.actorId !== undefined) {
      items = items.filter((e) => e.actorId === params.actorId);
    }
    if (params.eventType !== undefined) {
      items = items.filter((e) => e.eventType === params.eventType);
    }
    if (params.fromDate !== undefined) {
      const from = params.fromDate;
      items = items.filter((e) => e.occurredAt >= from);
    }
    if (params.toDate !== undefined) {
      const to = params.toDate;
      items = items.filter((e) => e.occurredAt <= to);
    }

    const total = items.length;
    const sliced = items.slice(params.offset, params.offset + params.limit);

    return Promise.resolve({
      items: sliced,
      total,
      limit: params.limit,
      offset: params.offset,
    });
  }
}
