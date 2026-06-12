import type { ReactNode } from "react";
import "@saas-reservas/ui/tokens.css";

export const metadata = {
  title: "SaaS Reservas — Admin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
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
