"use client";

import { useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";

/**
 * Form to provision a new tenant (US2, FR-008).
 * Posts to /api/v1/platform/tenants and refreshes the page on success.
 */
export function TenantCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/platform/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, displayName, defaultTimezone: timezone }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error === "slug-taken" ? "El identificador ya existe." : "No se pudo crear el tenant.");
        return;
      }
      setSlug("");
      setDisplayName("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Error de red.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-1)" }}
      >
        <PlusCircle size={16} aria-hidden />
        Nuevo tenant
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ui-space-3)",
        padding: "var(--ui-space-4)",
        border: "1px solid var(--ui-color-border)",
        borderRadius: "var(--ui-radius-md)",
        background: "var(--ui-color-surface)",
        maxWidth: 480,
      }}
    >
      <strong>Nuevo tenant</strong>

      <label>
        Identificador (slug)
        <input
          type="text"
          required
          pattern="[a-z0-9-]+"
          placeholder="mi-empresa"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </label>

      <label>
        Nombre
        <input
          type="text"
          required
          placeholder="Mi Empresa S.L."
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>

      <label>
        Zona horaria
        <input
          type="text"
          required
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        />
      </label>

      {error !== null && (
        <p role="alert" style={{ margin: 0, color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: "var(--ui-space-2)" }}>
        <button type="submit" disabled={submitting}>
          {submitting ? "Creando…" : "Crear"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
