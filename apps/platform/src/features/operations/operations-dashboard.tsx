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
// Types
// ---------------------------------------------------------------------------

type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";

export interface TenantOverview {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function billingStatusLabel(status: BillingStatus): string {
  switch (status) {
    case "trialing":  return "En prueba";
    case "active":    return "Activo";
    case "past_due":  return "Pago vencido";
    case "paused":    return "Pausado";
    case "canceled":  return "Cancelado";
  }
}

function billingStatusColor(status: BillingStatus): string {
  switch (status) {
    case "trialing":
    case "active":   return "var(--ui-color-success)";
    case "past_due":
    case "paused":   return "var(--ui-color-warning)";
    case "canceled": return "var(--ui-color-danger)";
  }
}

function BillingStatusIcon({ status }: { status: BillingStatus }) {
  const size = 15;
  switch (status) {
    case "trialing":
    case "active":   return <CheckCircle size={size} aria-hidden />;
    case "past_due": return <Clock size={size} aria-hidden />;
    case "paused":   return <AlertTriangle size={size} aria-hidden />;
    case "canceled": return <XCircle size={size} aria-hidden />;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes.toString()} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

function pct(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function barColor(p: number): string {
  if (p >= 90) return "var(--ui-color-danger)";
  if (p >= 70) return "var(--ui-color-warning)";
  return "var(--ui-color-success)";
}

function QuotaBar({ used, total }: { used: number; total: number }) {
  const p = pct(used, total);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: "var(--ui-color-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${p.toString()}%`,
            background: barColor(p),
            borderRadius: 3,
          }}
        />
      </div>
      <span
        style={{
          width: 36,
          textAlign: "right",
          fontSize: "var(--ui-text-xs)",
          color: "var(--ui-color-text-muted)",
        }}
      >
        {p.toString()}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tenant card
// ---------------------------------------------------------------------------

function TenantCard({ tenant }: { tenant: TenantOverview }) {
  return (
    <div
      style={{
        border: "1px solid var(--ui-color-border)",
        borderRadius: "var(--ui-radius-lg)",
        background: "var(--ui-color-surface)",
        padding: "var(--ui-space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--ui-space-3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600 }}>{tenant.tenantName}</p>
          <p style={{ margin: 0, fontSize: "var(--ui-text-sm)", color: "var(--ui-color-text-muted)" }}>
            {tenant.planName}
          </p>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--ui-space-1)",
            fontSize: "var(--ui-text-sm)",
            color: billingStatusColor(tenant.billingStatus),
          }}
        >
          <BillingStatusIcon status={tenant.billingStatus} />
          {billingStatusLabel(tenant.billingStatus)}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ui-space-2)" }}>
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "var(--ui-text-xs)",
              color: "var(--ui-color-text-muted)",
              marginBottom: "var(--ui-space-1)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Activity size={11} aria-hidden />
              Reservas
            </span>
            <span>
              {tenant.bookingsThisPeriod.toString()} / {tenant.bookingsQuota.toString()}
            </span>
          </div>
          <QuotaBar used={tenant.bookingsThisPeriod} total={tenant.bookingsQuota} />
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "var(--ui-text-xs)",
              color: "var(--ui-color-text-muted)",
              marginBottom: "var(--ui-space-1)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Database size={11} aria-hidden />
              Almacenamiento
            </span>
            <span>
              {formatBytes(tenant.storageUsedBytes)} / {formatBytes(tenant.storageQuotaBytes)}
            </span>
          </div>
          <QuotaBar used={tenant.storageUsedBytes} total={tenant.storageQuotaBytes} />
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "var(--ui-text-xs)",
              color: "var(--ui-color-text-muted)",
              marginBottom: "var(--ui-space-1)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Users size={11} aria-hidden />
              Notificaciones
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
// Exported dashboard
// ---------------------------------------------------------------------------

export function OperationsDashboard({ tenants }: { tenants: TenantOverview[] }) {
  if (tenants.length === 0) {
    return (
      <p style={{ color: "var(--ui-color-text-muted)" }}>
        No hay datos de uso disponibles.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "var(--ui-space-4)",
      }}
    >
      {tenants.map((t) => (
        <TenantCard key={t.tenantId} tenant={t} />
      ))}
    </div>
  );
}
