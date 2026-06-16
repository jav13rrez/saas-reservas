import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import "@saas-reservas/ui/tokens.css";

export const metadata = {
  title: "SaaS Reservas — Admin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "stretch" }}>
          <Sidebar />
          <main
            style={{
              flex: 1,
              minWidth: 0,
              padding: "var(--ui-space-7) var(--ui-space-8)",
            }}
          >
            <div style={{ maxWidth: 900, margin: "0 auto" }}>{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
