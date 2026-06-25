import { redirect } from "next/navigation";
import { BarChart2 } from "lucide-react";
import { hasPlatformSession, platformFetch } from "@/server/api-client";
import {
  OperationsDashboard,
  type TenantOverview,
} from "@/features/operations/operations-dashboard";

/**
 * Cross-tenant operations overview (US3, FR-012/FR-014/FR-015).
 * Reads tenant billing and quota data via the gated platform path.
 */
export default async function OperationsPage() {
  if (!(await hasPlatformSession())) {
    redirect("/");
  }

  let tenants: TenantOverview[] = [];
  try {
    const res = await platformFetch("/v1/ops/tenants");
    if (res.ok) {
      tenants = (await res.json()) as TenantOverview[];
    }
  } catch {
    // lista vacía; se muestra el componente con estado vacío
  }

  return (
    <section
      style={{ maxWidth: 900, margin: "0 auto", padding: "var(--ui-space-7) var(--ui-space-6)" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--ui-space-5)",
        }}
      >
        <h1
          style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)", margin: 0 }}
        >
          <BarChart2 size={22} aria-hidden />
          Operaciones
        </h1>
        <a href="/dashboard" style={{ color: "var(--ui-color-text-muted)" }}>
          Volver al panel
        </a>
      </header>

      <p style={{ color: "var(--ui-color-text-muted)", marginBottom: "var(--ui-space-5)" }}>
        Estado de facturacion y uso de cuotas por tenant.
      </p>

      <OperationsDashboard tenants={tenants} />
    </section>
  );
}
