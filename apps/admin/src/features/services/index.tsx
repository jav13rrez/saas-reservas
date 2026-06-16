"use client";

/**
 * Servicios screen. Lists the tenant catalog and lets the operator create a
 * service or toggle it active/inactive, talking to /api/services.
 *
 * Resource association is configured from the Recursos screen (hub model):
 * the resource declares which services consume its capacity, not the service.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useState } from "react";
import { Package, Plus, RefreshCw } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface AdminService {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  bufferAfterMinutes: number;
  priceAmount: number;
  currency: string;
  active: boolean;
}

const CELL: React.CSSProperties = {
  padding: "var(--ui-space-3)",
  borderBottom: "1px solid var(--ui-color-border)",
  textAlign: "left",
};

export function Services() {
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [duration, setDuration] = useState(30);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [price, setPrice] = useState(40);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/services");
      if (!res.ok) {
        throw new Error("No se pudo cargar servicios.");
      }
      setServices(((await res.json()) as { items: AdminService[] }).items);
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
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          durationMinutes: duration,
          bufferAfterMinutes: bufferAfter,
          priceAmount: Math.round(price * 100),
          currency: "EUR",
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Creación falló con ${String(res.status)}`);
      }
      setName("");
      setCategory("General");
      setDuration(30);
      setBufferAfter(0);
      setPrice(40);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(service: AdminService) {
    setError(null);
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !service.active }),
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
        <Package size={20} aria-hidden />
        Servicios
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 640 }}>
        Catálogo de servicios reservables del tenant. Los recursos que consume cada servicio se
        configuran desde la pantalla de Recursos.
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
            placeholder="Consulta inicial"
          />
        </label>
        <label>
          Categoría
          <input
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
            }}
          />
        </label>
        <label>
          Duración (min)
          <input
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value));
            }}
            style={{ width: 110 }}
          />
        </label>
        <label>
          Buffer (min)
          <input
            type="number"
            min={0}
            step={5}
            value={bufferAfter}
            onChange={(e) => {
              setBufferAfter(Number(e.target.value));
            }}
            style={{ width: 110 }}
          />
        </label>
        <label>
          Precio (EUR)
          <input
            type="number"
            min={0}
            step={0.5}
            value={price}
            onChange={(e) => {
              setPrice(Number(e.target.value));
            }}
            style={{ width: 120 }}
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
        >
          <Plus size={16} aria-hidden />
          {submitting ? "Creando…" : "Crear servicio"}
        </button>
      </form>

      {error !== null && (
        <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2>Catálogo</h2>
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
      ) : services.length === 0 ? (
        <p style={{ color: "var(--ui-color-text-muted)" }}>
          Aún no hay servicios. Crea el primero arriba.
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
              <th style={CELL}>Servicio</th>
              <th style={CELL}>Categoría</th>
              <th style={CELL}>Duración</th>
              <th style={CELL}>Precio</th>
              <th style={CELL}>Estado</th>
              <th style={CELL}></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td style={CELL}>{s.name}</td>
                <td style={CELL}>{s.category}</td>
                <td style={CELL}>
                  {s.durationMinutes} min
                  {s.bufferAfterMinutes > 0 ? ` (+${String(s.bufferAfterMinutes)})` : ""}
                </td>
                <td style={CELL}>{formatMoney(s.priceAmount, s.currency)}</td>
                <td style={CELL}>
                  <span
                    style={{
                      padding: "2px var(--ui-space-2)",
                      borderRadius: "var(--ui-radius-sm)",
                      fontSize: "var(--ui-text-sm)",
                      fontWeight: 500,
                      color: s.active ? "var(--ui-color-success)" : "var(--ui-color-text-muted)",
                      background: s.active ? "#e7f6ec" : "var(--ui-color-bg)",
                    }}
                  >
                    {s.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td style={{ ...CELL, textAlign: "right" }}>
                  <button
                    onClick={() => void toggleActive(s)}
                    style={{ height: 30, padding: "0 var(--ui-space-3)" }}
                  >
                    {s.active ? "Desactivar" : "Activar"}
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
