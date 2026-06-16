"use client";

/**
 * Primary admin navigation (sidebar). Lists every product area so the admin
 * shell looks and behaves like a SaaS console. Areas that still lack a screen
 * render a placeholder; the backend logic already exists behind their APIs.
 *
 * Icons come from lucide-react only and all colors read design tokens
 * (docs/design-system.md, ADR-0008). No emojis.
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Package,
  UserCog,
  Contact,
  Ticket,
  CreditCard,
  BarChart2,
  ScrollText,
  Settings,
  Boxes,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: "General",
    items: [{ href: "/", label: "Inicio", icon: LayoutDashboard }],
  },
  {
    title: "Agenda",
    items: [
      { href: "/bookings", label: "Reservas", icon: CalendarCheck },
      { href: "/calendar", label: "Calendario", icon: CalendarDays },
      { href: "/events", label: "Eventos", icon: Ticket },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/services", label: "Servicios", icon: Package },
      { href: "/resources", label: "Recursos", icon: Boxes },
      { href: "/locations", label: "Ubicaciones", icon: MapPin },
      { href: "/providers", label: "Proveedores", icon: UserCog },
      { href: "/customers", label: "Clientes", icon: Contact },
    ],
  },
  {
    title: "Administración",
    items: [
      { href: "/billing", label: "Facturación", icon: CreditCard },
      { href: "/operations", label: "Operaciones", icon: BarChart2 },
      { href: "/audit", label: "Auditoría", icon: ScrollText },
      { href: "/settings", label: "Configuración", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid var(--ui-color-border)",
        background: "var(--ui-color-surface)",
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        padding: "var(--ui-space-5) var(--ui-space-3)",
        gap: "var(--ui-space-5)",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--ui-space-2)",
          padding: "0 var(--ui-space-2)",
          fontWeight: 600,
          fontSize: "var(--ui-text-lg)",
        }}
      >
        <CalendarCheck size={20} aria-hidden />
        SaaS Reservas
      </div>

      {SECTIONS.map((section) => (
        <div
          key={section.title}
          style={{ display: "flex", flexDirection: "column", gap: "var(--ui-space-1)" }}
        >
          <span
            style={{
              padding: "0 var(--ui-space-2)",
              fontSize: "var(--ui-text-sm)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--ui-color-text-muted)",
            }}
          >
            {section.title}
          </span>
          {section.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--ui-space-2)",
                  padding: "var(--ui-space-2) var(--ui-space-2)",
                  borderRadius: "var(--ui-radius-md)",
                  textDecoration: "none",
                  fontSize: "var(--ui-text-base)",
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--ui-color-primary)" : "var(--ui-color-text)",
                  background: active ? "var(--ui-color-primary-soft)" : "transparent",
                }}
              >
                <Icon size={16} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
