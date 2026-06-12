import type { ReactNode } from "react";

export const metadata = {
  title: "Reservas",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem auto", maxWidth: 560 }}>
        {children}
      </body>
    </html>
  );
}
