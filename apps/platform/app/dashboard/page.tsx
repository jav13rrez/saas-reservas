import { redirect } from "next/navigation";
import { LayoutDashboard, Building2, BarChart2 } from "lucide-react";
import { hasPlatformSession } from "@/server/api-client";
import { LogoutButton } from "@/features/logout-button";

/**
 * Post-login landing for the platform surface (US1/US2). Gated by the
 * platform_session cookie: without it the operator is sent back to sign-in.
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
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 560, marginBottom: "var(--ui-space-5)" }}>
        Has iniciado sesión como operador de la plataforma.
      </p>
      <nav style={{ display: "flex", flexDirection: "column", gap: "var(--ui-space-3)" }}>
        <a
          href="/dashboard/tenants"
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
        >
          <Building2 size={18} aria-hidden />
          Gestionar tenants
        </a>
        <a
          href="/dashboard/operations"
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
        >
          <BarChart2 size={18} aria-hidden />
          Operaciones
        </a>
      </nav>
    </section>
  );
}
