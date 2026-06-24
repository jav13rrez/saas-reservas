import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { hasPlatformSession } from "@/server/api-client";
import { LogoutButton } from "@/features/logout-button";

/**
 * Post-login landing for the platform surface (US1). Gated by the
 * platform_session cookie: without it the operator is sent back to sign-in. The
 * cross-tenant operations overview is added here in US3 (FR-012).
 */
export default async function Dashboard() {
  if (!(await hasPlatformSession())) {
    redirect("/");
  }
  return (
    <section style={{ maxWidth: 720, margin: "0 auto", padding: "var(--ui-space-7) var(--ui-space-6)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)", margin: 0 }}>
          <LayoutDashboard size={22} aria-hidden />
          Plataforma
        </h1>
        <LogoutButton />
      </header>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 560 }}>
        Has iniciado sesión como operador de la plataforma. Desde aquí se gestionará el
        aprovisionamiento de tenants y la vista de operaciones entre tenants.
      </p>
    </section>
  );
}
