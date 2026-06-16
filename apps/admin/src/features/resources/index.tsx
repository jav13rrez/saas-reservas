"use client";

/**
 * Recursos screen (model B/C). A resource is a pool with a quantity at a
 * location (rooms, boxes, chairs, machines). Services demand units of a
 * resource and bookings are capped by its quantity. Talks to /api/resources
 * and /api/locations.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Plus, RefreshCw } from "lucide-react";

interface AdminLocation {
  id: string;
  name: string;
  active: boolean;
}

interface AdminResource {
  id: string;
  name: string;
  quantity: number;
  locationId?: string;
  active: boolean;
}

const CELL: React.CSSProperties = {
  padding: "var(--ui-space-3)",
  borderBottom: "1px solid var(--ui-color-border)",
  textAlign: "left",
};

export function Resources() {
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [locationId, setLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeLocations = useMemo(() => locations.filter((l) => l.active), [locations]);
  const locationName = useCallback(
    (id: string | undefined) =>
      id === undefined ? "—" : (locations.find((l) => l.id === id)?.name ?? "—"),
    [locations],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, lRes] = await Promise.all([fetch("/api/resources"), fetch("/api/locations")]);
      if (!rRes.ok || !lRes.ok) {
        throw new Error("No se pudo cargar recursos o ubicaciones.");
      }
      const rBody = (await rRes.json()) as { items: AdminResource[] };
      const lBody = (await lRes.json()) as { items: AdminLocation[] };
      setResources(rBody.items);
      setLocations(lBody.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (locationId === "" && activeLocations.length > 0) {
      setLocationId(activeLocations[0]?.id ?? "");
    }
  }, [activeLocations, locationId]);

  async function handleCreate(event: { preventDefault(): void }) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, quantity, locationId }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Creación falló con ${String(res.status)}`);
      }
      setName("");
      setQuantity(1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(resource: AdminResource) {
    setError(null);
    try {
      const res = await fetch(`/api/resources/${resource.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !resource.active }),
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
        <Boxes size={20} aria-hidden />
        Recursos
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 640 }}>
        Activos físicos limitados (salas, boxes, sillones, máquinas). La cantidad es el número de
        unidades simultáneas: un servicio que exija una unidad no podrá superar esa capacidad por
        franja horaria.
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
            placeholder="Sala de terapia"
          />
        </label>
        <label>
          Cantidad (unidades)
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => {
              setQuantity(Number(e.target.value));
            }}
            style={{ width: 140 }}
          />
        </label>
        <label>
          Ubicación
          <select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
            }}
            style={{ minWidth: 180 }}
          >
            <option value="">Sin ubicación</option>
            {activeLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={submitting}
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
        >
          <Plus size={16} aria-hidden />
          {submitting ? "Creando…" : "Crear recurso"}
        </button>
      </form>

      {error !== null && (
        <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2>Inventario</h2>
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
      ) : resources.length === 0 ? (
        <p style={{ color: "var(--ui-color-text-muted)" }}>
          Aún no hay recursos. Crea el primero arriba.
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
              <th style={CELL}>Recurso</th>
              <th style={CELL}>Cantidad</th>
              <th style={CELL}>Ubicación</th>
              <th style={CELL}>Estado</th>
              <th style={CELL}></th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id}>
                <td style={CELL}>{r.name}</td>
                <td style={CELL}>{r.quantity}</td>
                <td style={CELL}>{locationName(r.locationId)}</td>
                <td style={CELL}>
                  <span
                    style={{
                      padding: "2px var(--ui-space-2)",
                      borderRadius: "var(--ui-radius-sm)",
                      fontSize: "var(--ui-text-sm)",
                      fontWeight: 500,
                      color: r.active ? "var(--ui-color-success)" : "var(--ui-color-text-muted)",
                      background: r.active ? "#e7f6ec" : "var(--ui-color-bg)",
                    }}
                  >
                    {r.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td style={{ ...CELL, textAlign: "right" }}>
                  <button
                    onClick={() => void toggleActive(r)}
                    style={{ height: 30, padding: "0 var(--ui-space-3)" }}
                  >
                    {r.active ? "Desactivar" : "Activar"}
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
