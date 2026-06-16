/**
 * Admin home (Inicio). A lightweight overview that orients the operator and
 * links into each product area. It does not fetch live data yet; the metric
 * tiles read placeholder values until the reporting endpoints are wired.
 *
 * Styling reads design tokens only; icons from lucide-react. No emojis.
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarCheck,
  Package,
  CreditCard,
  BarChart2,
  Settings,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface ShortcutCard {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const SHORTCUTS: ShortcutCard[] = [
  {
    href: "/bookings",
    label: "Reservas",
    description: "Agenda de citas, cambios y cancelaciones.",
    icon: CalendarCheck,
  },
  {
    href: "/services",
    label: "Servicios",
    description: "Catálogo de servicios reservables y precios.",
    icon: Package,
  },
  {
    href: "/billing",
    label: "Facturación",
    description: "Plan, cuotas y consumo del tenant.",
    icon: CreditCard,
  },
  {
    href: "/operations",
    label: "Operaciones",
    description: "Estado de tenants, cuotas y registro de auditoría.",
    icon: BarChart2,
  },
  {
    href: "/settings",
    label: "Configuración",
    description: "Publicar un servicio y previsualizar disponibilidad.",
    icon: Settings,
  },
];

export function Dashboard() {
  return (
    <section>
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
        <LayoutDashboard size={20} aria-hidden />
        Inicio
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 640 }}>
        Consola de administración del tenant. Selecciona un área en el menú lateral o usa los
        accesos directos.
      </p>

      <h2>Accesos directos</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "var(--ui-space-4)",
        }}
      >
        {SHORTCUTS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--ui-space-2)",
                padding: "var(--ui-space-5)",
                borderRadius: "var(--ui-radius-lg)",
                border: "1px solid var(--ui-color-border)",
                background: "var(--ui-color-surface)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ui-space-2)",
                  fontWeight: 600,
                }}
              >
                <Icon size={18} aria-hidden />
                {card.label}
              </span>
              <span style={{ color: "var(--ui-color-text-muted)", fontSize: "var(--ui-text-sm)" }}>
                {card.description}
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ui-space-1)",
                  marginTop: "var(--ui-space-1)",
                  color: "var(--ui-color-primary)",
                  fontSize: "var(--ui-text-sm)",
                  fontWeight: 500,
                }}
              >
                Abrir
                <ArrowRight size={14} aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
