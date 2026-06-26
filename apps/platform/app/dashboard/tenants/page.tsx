import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { hasPlatformSession, platformFetch } from "@/server/api-client";
import { TenantCreateForm } from "@/features/tenant-create-form";
import { TenantLifecycleButton } from "@/features/tenant-lifecycle-button";

interface TenantItem {
  id: string;
  slug: string;
  displayName: string;
  status: "active" | "suspended";
}

/**
 * Tenant provisioning and lifecycle management (US2, FR-008/FR-021).
 * Lists all tenants with their status and provides suspend/reactivate actions.
 */
export default async function TenantsPage() {
  if (!(await hasPlatformSession())) {
    redirect("/");
  }

  let tenants: TenantItem[] = [];
  try {
    const response = await platformFetch("/v1/platform/tenants");
    if (response.ok) {
      const data = (await response.json()) as { items: TenantItem[] };
      tenants = data.items;
    }
  } catch {
    // La lista queda vacía; se muestra de todos modos el formulario de creación.
  }

  return (
    <section
      style={{ maxWidth: 760, margin: "0 auto", padding: "var(--ui-space-7) var(--ui-space-6)" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--ui-space-5)",
        }}
      >
        <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)", margin: 0 }}>
          <Building2 size={22} aria-hidden />
          Tenants
        </h1>
        <a href="/dashboard" style={{ color: "var(--ui-color-text-muted)" }}>
          Volver al panel
        </a>
      </header>

      <TenantCreateForm />

      {tenants.length === 0 ? (
        <p style={{ color: "var(--ui-color-text-muted)", marginTop: "var(--ui-space-5)" }}>
          No hay tenants todavía. Crea el primero con el formulario de arriba.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "var(--ui-space-5)",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "var(--ui-space-2) var(--ui-space-3)",
                  borderBottom: "2px solid var(--ui-color-border)",
                }}
              >
                Tenant
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "var(--ui-space-2) var(--ui-space-3)",
                  borderBottom: "2px solid var(--ui-color-border)",
                }}
              >
                Identificador
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "var(--ui-space-2) var(--ui-space-3)",
                  borderBottom: "2px solid var(--ui-color-border)",
                }}
              >
                Estado
              </th>
              <th
                style={{
                  padding: "var(--ui-space-2) var(--ui-space-3)",
                  borderBottom: "2px solid var(--ui-color-border)",
                }}
              />
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td
                  style={{
                    padding: "var(--ui-space-2) var(--ui-space-3)",
                    borderBottom: "1px solid var(--ui-color-border)",
                  }}
                >
                  {tenant.displayName}
                </td>
                <td
                  style={{
                    padding: "var(--ui-space-2) var(--ui-space-3)",
                    borderBottom: "1px solid var(--ui-color-border)",
                    color: "var(--ui-color-text-muted)",
                    fontFamily: "monospace",
                  }}
                >
                  {tenant.slug}
                </td>
                <td
                  style={{
                    padding: "var(--ui-space-2) var(--ui-space-3)",
                    borderBottom: "1px solid var(--ui-color-border)",
                    color:
                      tenant.status === "active"
                        ? "var(--ui-color-success)"
                        : "var(--ui-color-warning)",
                  }}
                >
                  {tenant.status === "active" ? "Activo" : "Suspendido"}
                </td>
                <td
                  style={{
                    padding: "var(--ui-space-2) var(--ui-space-3)",
                    borderBottom: "1px solid var(--ui-color-border)",
                    textAlign: "right",
                  }}
                >
                  <TenantLifecycleButton tenantId={tenant.id} currentStatus={tenant.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
