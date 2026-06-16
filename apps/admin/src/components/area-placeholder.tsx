/**
 * Shared scaffold for product areas whose backend exists but whose admin
 * screen is not built yet. Keeps the console honest: it names the area, what
 * it will do, and which API/domain already backs it.
 *
 * Styling reads design tokens only; icons are passed in from lucide-react.
 */

import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

interface AreaPlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Backend capabilities that already exist behind this area. */
  backed: string[];
}

export function AreaPlaceholder({ icon: Icon, title, description, backed }: AreaPlaceholderProps) {
  return (
    <section>
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
        <Icon size={20} aria-hidden />
        {title}
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 640 }}>{description}</p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--ui-space-2)",
          marginTop: "var(--ui-space-5)",
          padding: "var(--ui-space-3) var(--ui-space-4)",
          borderRadius: "var(--ui-radius-md)",
          border: "1px solid var(--ui-color-border)",
          background: "var(--ui-color-surface)",
          color: "var(--ui-color-warning)",
          fontWeight: 500,
          maxWidth: 640,
        }}
      >
        <Construction size={16} aria-hidden />
        Pantalla en construcción — la lógica de dominio ya existe y está probada.
      </div>

      <h2>Capacidades disponibles en el backend</h2>
      <ul style={{ maxWidth: 640 }}>
        {backed.map((item) => (
          <li key={item} style={{ marginBottom: "var(--ui-space-1)" }}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
