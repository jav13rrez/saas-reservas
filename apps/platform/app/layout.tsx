import type { ReactNode } from "react";
import "@saas-reservas/ui/tokens.css";

export const metadata = {
  title: "SaaS Reservas — Plataforma",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <main style={{ minHeight: "100vh" }}>{children}</main>
      </body>
    </html>
  );
}
