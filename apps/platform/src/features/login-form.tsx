"use client";

import { useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

/**
 * Platform operator login (US1). Posts credentials to the proxied platform API
 * (`/api/v1/platform/sessions`), which sets the HttpOnly platform_session cookie
 * on this origin, then redirects to the dashboard. No tenant context is involved.
 * Styling reads design tokens only; the icon is from lucide-react (ADR-0008).
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/platform/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError("Credenciales no válidas.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("No se pudo conectar con la plataforma.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      style={{
        width: "100%",
        maxWidth: 380,
        display: "flex",
        flexDirection: "column",
        gap: "var(--ui-space-4)",
        padding: "var(--ui-space-6)",
        borderRadius: "var(--ui-radius-lg)",
        border: "1px solid var(--ui-color-border)",
        background: "var(--ui-color-surface)",
      }}
    >
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)", margin: 0 }}>
        <ShieldCheck size={22} aria-hidden />
        Plataforma
      </h1>
      <p style={{ margin: 0, color: "var(--ui-color-text-muted)" }}>
        Acceso para operadores de la plataforma.
      </p>

      <label>
        Correo
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label>
        Contraseña
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error !== null ? (
        <p role="alert" style={{ margin: 0, color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting}>
        {submitting ? "Accediendo…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
