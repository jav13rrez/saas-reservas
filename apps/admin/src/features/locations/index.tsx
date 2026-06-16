"use client";

/**
 * Ubicaciones screen (multi-site, model C). Lists locations and lets the
 * operator create one or toggle it active/inactive, talking to /api/locations.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, RefreshCw } from "lucide-react";

interface AdminLocation {
  id: string;
  name: string;
  timezone?: string;
  address?: string;
  active: boolean;
}

const CELL: React.CSSProperties = {
  padding: "var(--ui-space-3)",
  borderBottom: "1px solid var(--ui-color-border)",
  textAlign: "left",
};

export function Locations() {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) {
        throw new Error(`Listado falló con ${String(res.status)}`);
      }
      const body = (await res.json()) as { items: AdminLocation[] };
      setLocations(body.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: { preventDefault(): void }) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, timezone, address }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Creación falló con ${String(res.status)}`);
      }
      setName("");
      setAddress("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(location: AdminLocation) {
    setError(null);
    try {
      const res = await fetch(`/api/locations/${location.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !location.active }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `Actualización falló con ${String(res.status)}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  return (
    <section>
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
        <MapPin size={20} aria-hidden />
        Ubicaciones
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 640 }}>
        Sedes físicas del tenant. Cada recurso pertenece a una ubicación; los servicios se prestan
        en la sede de sus recursos.
      </p>

      <form
        onSubmit={(e) => void handleCreate(e)}
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: "var(--ui-space-3)",
          margin: "var(--ui-space-5) 0",
        }}
      >
        <label>
          Nombre
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            required
            placeholder="Sede Centro"
          />
        </label>
        <label>
          Zona horaria
          <input
            value={timezone}
            onChange={(e) => {
              setTimezone(e.target.value);
            }}
            placeholder="Europe/Madrid"
          />
        </label>
        <label>
          Dirección
          <input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
            }}
            placeholder="Calle Mayor 1"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
        >
          <Plus size={16} aria-hidden />
          {submitting ? "Creando…" : "Crear ubicación"}
        </button>
      </form>

      {error !== null && (
        <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2>Sedes</h2>
        <button
          onClick={() => void load()}
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
        >
          <RefreshCw size={14} aria-hidden />
          Actualizar
        </button>
      </div>

      {loading ? (
        <p role="status">Cargando…</p>
      ) : locations.length === 0 ? (
        <p style={{ color: "var(--ui-color-text-muted)" }}>
          Aún no hay ubicaciones. Crea la primera arriba.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "var(--ui-color-surface)",
            borderRadius: "var(--ui-radius-lg)",
            overflow: "hidden",
            border: "1px solid var(--ui-color-border)",
          }}
        >
          <thead>
            <tr style={{ color: "var(--ui-color-text-muted)", fontSize: "var(--ui-text-sm)" }}>
              <th style={CELL}>Nombre</th>
              <th style={CELL}>Zona horaria</th>
              <th style={CELL}>Dirección</th>
              <th style={CELL}>Estado</th>
              <th style={CELL}></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td style={CELL}>{l.name}</td>
                <td style={CELL}>{l.timezone ?? "—"}</td>
                <td style={CELL}>{l.address ?? "—"}</td>
                <td style={CELL}>
                  <span
                    style={{
                      padding: "2px var(--ui-space-2)",
                      borderRadius: "var(--ui-radius-sm)",
                      fontSize: "var(--ui-text-sm)",
                      fontWeight: 500,
                      color: l.active ? "var(--ui-color-success)" : "var(--ui-color-text-muted)",
                      background: l.active ? "#e7f6ec" : "var(--ui-color-bg)",
                    }}
                  >
                    {l.active ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td style={{ ...CELL, textAlign: "right" }}>
                  <button
                    onClick={() => void toggleActive(l)}
                    style={{ height: 30, padding: "0 var(--ui-space-3)" }}
                  >
                    {l.active ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
