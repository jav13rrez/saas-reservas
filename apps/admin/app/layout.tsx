import type { ReactNode } from "react";
import Link from "next/link";
import { Settings, BarChart2 } from "lucide-react";
import "@saas-reservas/ui/tokens.css";

export const metadata = {
  title: "SaaS Reservas — Admin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ui-space-4)",
            padding: "var(--ui-space-3) var(--ui-space-6)",
            borderBottom: "1px solid var(--ui-color-border, #e5e7eb)",
            background: "#fff",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ui-space-2)",
              textDecoration: "none",
              color: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            <Settings size={16} />
            Setup
          </Link>
          <Link
            href="/operations"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--ui-space-2)",
              textDecoration: "none",
              color: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            <BarChart2 size={16} />
            Operations
          </Link>
        </nav>
        <div
          style={{
            margin: "var(--ui-space-7) auto",
            maxWidth: 720,
            padding: "0 var(--ui-space-4)",
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
