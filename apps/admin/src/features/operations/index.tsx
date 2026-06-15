"use client";

/**
 * Operations dashboard (T077).
 *
 * Displays per-tenant billing status, quota usage, and recent audit events.
 * Uses the audit search API (T078) and billing domain helpers (T076).
 * All data is loaded from the API; the UI is read-only (operators monitor,
 * they don't mutate from here).
 */

import { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Users,
  XCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types mirroring the API / billing domain
// ---------------------------------------------------------------------------

type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";

interface TenantOverview {
  tenantId: string;
  tenantName: string;
  planName: string;
  billingStatus: BillingStatus;
  bookingsThisPeriod: number;
  bookingsQuota: number;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  notificationsThisPeriod: number;
  notificationsQuota: number;
}

interface AuditEntry {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string;
  occurredAt: string;
  resourceId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusIcon(status: BillingStatus) {
  switch (status) {
    case "active":
    case "trialing":
      return <CheckCircle size={16} className="text-green-500" />;
    case "past_due":
      return <Clock size={16} className="text-yellow-500" />;
    case "paused":
      return <AlertTriangle size={16} className="text-orange-500" />;
    case "canceled":
      return <XCircle size={16} className="text-red-500" />;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toString()} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function quotaPct(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function QuotaBar({ used, total }: { used: number; total: number }) {
  const pct = quotaPct(used, total);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-400" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded bg-gray-200">
        <div className={`h-2 rounded ${color}`} style={{ width: `${pct.toString()}%` }} />
      </div>
      <span className="w-10 text-right text-xs text-gray-500">{pct.toString()}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tenant card
// ---------------------------------------------------------------------------

function TenantCard({ tenant }: { tenant: TenantOverview }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">{tenant.tenantName}</p>
          <p className="text-sm text-gray-500">{tenant.planName}</p>
        </div>
        <div className="flex items-center gap-1 text-sm capitalize text-gray-600">
          {statusIcon(tenant.billingStatus)}
          <span>{tenant.billingStatus.replace("_", " ")}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Activity size={12} />
              Bookings
            </span>
            <span>
              {tenant.bookingsThisPeriod.toString()} / {tenant.bookingsQuota.toString()}
            </span>
          </div>
          <QuotaBar used={tenant.bookingsThisPeriod} total={tenant.bookingsQuota} />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Database size={12} />
              Storage
            </span>
            <span>
              {formatBytes(tenant.storageUsedBytes)} / {formatBytes(tenant.storageQuotaBytes)}
            </span>
          </div>
          <QuotaBar used={tenant.storageUsedBytes} total={tenant.storageQuotaBytes} />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Users size={12} />
              Notifications
            </span>
            <span>
              {tenant.notificationsThisPeriod.toString()} / {tenant.notificationsQuota.toString()}
            </span>
          </div>
          <QuotaBar used={tenant.notificationsThisPeriod} total={tenant.notificationsQuota} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log panel
// ---------------------------------------------------------------------------

function AuditPanel({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">No audit events found.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs font-medium uppercase text-gray-500">
          <th className="py-2 pr-4">Event</th>
          <th className="py-2 pr-4">Actor</th>
          <th className="py-2 pr-4">Resource</th>
          <th className="py-2">Time</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id} className="border-b last:border-0">
            <td className="py-2 pr-4 font-mono text-xs text-gray-700">{e.eventType}</td>
            <td className="py-2 pr-4 text-gray-600">
              <span className="rounded bg-gray-100 px-1 text-xs">{e.actorType}</span> {e.actorId}
            </td>
            <td className="py-2 pr-4 text-xs text-gray-500">{e.resourceId ?? "-"}</td>
            <td className="py-2 text-xs text-gray-500">
              {new Date(e.occurredAt).toLocaleString("en-GB", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function OperationsDashboard() {
  const [tenants, setTenants] = useState<TenantOverview[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/ops/tenants")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status.toString()}`);
        return r.json() as Promise<TenantOverview[]>;
      })
      .then((data) => {
        setTenants(data);
        if (data.length > 0) {
          setSelectedTenantId(data[0]?.tenantId ?? "");
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load tenants");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedTenantId.length === 0) return;
    setAuditLoading(true);
    fetch("/api/audit/events?limit=20", {
      headers: { "x-tenant-id": selectedTenantId },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status.toString()}`);
        return r.json() as Promise<{ items: AuditEntry[] }>;
      })
      .then((data) => {
        setAuditEntries(data.items);
      })
      .catch(() => {
        setAuditEntries([]);
      })
      .finally(() => {
        setAuditLoading(false);
      });
  }, [selectedTenantId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
          <p className="text-sm text-gray-500">Tenant billing health and audit activity</p>
        </header>

        {error !== null && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && <p className="text-sm text-gray-500">Loading tenants...</p>}

        {!loading && tenants.length > 0 && (
          <>
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-semibold text-gray-800">Tenant Overview</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tenants.map((t) => (
                  <button
                    key={t.tenantId}
                    onClick={() => {
                      setSelectedTenantId(t.tenantId);
                    }}
                    className={`cursor-pointer text-left ${selectedTenantId === t.tenantId ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <TenantCard tenant={t} />
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">
                  Audit Log
                  {selectedTenantId.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      — {tenants.find((t) => t.tenantId === selectedTenantId)?.tenantName}
                    </span>
                  )}
                </h2>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                {auditLoading ? (
                  <p className="text-sm text-gray-500">Loading audit events...</p>
                ) : (
                  <AuditPanel entries={auditEntries} />
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
