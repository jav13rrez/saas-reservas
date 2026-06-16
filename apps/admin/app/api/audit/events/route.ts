import { NextResponse } from "next/server";

/**
 * GET /api/audit/events
 *
 * Returns a mock paginated audit log for the tenant identified by the
 * x-tenant-id request header.
 */

type AuditEventType =
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

type ActorType = "customer" | "provider" | "staff" | "system";

interface AuditLogEntry {
  id: string;
  tenantId: string;
  eventType: AuditEventType;
  actorType: ActorType;
  actorId: string;
  resourceId?: string;
  resourceType?: string;
  occurredAt: string;
}

function mockEntries(tenantId: string): AuditLogEntry[] {
  const base = new Date("2026-06-15T10:00:00.000Z");
  const entries: [AuditEventType, ActorType, string, string?][] = [
    ["booking.created", "customer", "customer@example.com", "bk-001"],
    ["payment.captured", "system", "payment-gateway", "bk-001"],
    ["provider.updated", "staff", "admin@tenant.example", "prov-001"],
    ["service.created", "staff", "admin@tenant.example", "svc-001"],
    ["tenant.plan_changed", "system", "billing-service"],
  ];
  return entries.map(([eventType, actorType, actorId, resourceId], i) => {
    const occurredAt = new Date(base.getTime() - i * 3_600_000).toISOString();
    const entry: AuditLogEntry = {
      id: `audit-${tenantId}-${i.toString()}`,
      tenantId,
      eventType,
      actorType,
      actorId,
      occurredAt,
    };
    if (resourceId !== undefined) {
      entry.resourceId = resourceId;
    }
    return entry;
  });
}

export function GET(request: Request): NextResponse {
  const tenantId = new Headers(request.headers).get("x-tenant-id") ?? "unknown";
  const items = mockEntries(tenantId);
  return NextResponse.json({
    items,
    total: items.length,
    limit: 20,
    offset: 0,
  });
}
