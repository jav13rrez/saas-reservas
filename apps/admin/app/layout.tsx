import type { ReactNode } from "react";

export const metadata = {
  title: "SaaS Reservas — Admin",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem auto", maxWidth: 720 }}>
        {children}
      </body>
    </html>
  );
}
