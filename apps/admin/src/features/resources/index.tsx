"use client";

/**
 * Recursos screen — hub model. A resource declares which locations it lives at,
 * which services trigger its allocation, and which providers are eligible for it.
 * This is the single place to configure the full resource↔service↔provider
 * relationship. Talks to /api/resources, /api/locations, /api/services and
 * /api/providers.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Plus, RefreshCw, Save, X } from "lucide-react";

interface AdminLocation {
  id: string;
  name: string;
  active: boolean;
}
interface AdminService {
  id: string;
  name: string;
  active: boolean;
}
interface AdminProvider {
  id: string;
  name: string;
  active: boolean;
}
interface AdminResource {
  id: string;
  name: string;
  quantity: number;
  locationIds: string[];
  serviceIds: string[];
  employeeIds: string[];
  active: boolean;
}

const CELL: React.CSSProperties = {
  padding: "var(--ui-space-3)",
  borderBottom: "1px solid var(--ui-color-border)",
  textAlign: "left",
  verticalAlign: "top",
};

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function emptyForm() {
  return {
    name: "",
    quantity: 1,
    locationIds: [] as string[],
    serviceIds: [] as string[],
    employeeIds: [] as string[],
  };
}

export function Resources() {
  const [resources, setResources] = useState<AdminResource[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const activeLocations = useMemo(() => locations.filter((l) => l.active), [locations]);
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const activeProviders = useMemo(() => providers.filter((p) => p.active), [providers]);

  const nameOf = useCallback(
    (items: { id: string; name: string }[], id: string) =>
      items.find((i) => i.id === id)?.name ?? id,
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, lRes, sRes, pRes] = await Promise.all([
        fetch("/api/resources"),
        fetch("/api/locations"),
        fetch("/api/services"),
        fetch("/api/providers"),
      ]);
      if (!rRes.ok || !lRes.ok || !sRes.ok || !pRes.ok) {
        throw new Error("No se pudo cargar la información de recursos.");
      }
      setResources(((await rRes.json()) as { items: AdminResource[] }).items);
      setLocations(((await lRes.json()) as { items: AdminLocation[] }).items);
      setServices(((await sRes.json()) as { items: AdminService[] }).items);
      setProviders(((await pRes.json()) as { items: AdminProvider[] }).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEdit(r: AdminResource) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      quantity: r.quantity,
      locationIds: [...r.locationIds],
      serviceIds: [...r.serviceIds],
      employeeIds: [...r.employeeIds],
    });
  }

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = editingId === null ? "/api/resources" : `/api/resources/${editingId}`;
      const method = editingId === null ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Operación falló con ${String(res.status)}`);
      }
      startCreate();
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
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 680 }}>
        Activos físicos limitados (salas, boxes, sillones, equipos). El recurso declara en qué
        ubicaciones existe, qué servicios consumen su capacidad y qué proveedores son elegibles para
        usarlo. Sin proveedores marcados, cualquier proveedor puede usarlo.
      </p>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--ui-space-4)",
          margin: "var(--ui-space-5) 0",
          padding: "var(--ui-space-4)",
          border: "1px solid var(--ui-color-border)",
          borderRadius: "var(--ui-radius-lg)",
          background: "var(--ui-color-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong>{editingId === null ? "Nuevo recurso" : "Editar recurso"}</strong>
          {editingId !== null && (
            <button
              type="button"
              onClick={startCreate}
              style={{
                height: 30,
                padding: "0 var(--ui-space-3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--ui-space-1)",
              }}
            >
              <X size={14} aria-hidden />
              Cancelar edición
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ui-space-3)" }}>
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
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
              value={form.quantity}
              onChange={(e) => {
                setForm((f) => ({ ...f, quantity: Number(e.target.value) }));
              }}
              style={{ width: 140 }}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--ui-space-4)",
          }}
        >
          <CheckboxGroup
            title="Ubicaciones"
            hint="Vacío = cualquier ubicación"
            empty="No hay ubicaciones activas."
            options={activeLocations}
            selected={form.locationIds}
            onToggle={(id) => {
              setForm((f) => ({ ...f, locationIds: toggle(f.locationIds, id) }));
            }}
          />
          <CheckboxGroup
            title="Servicios que consumen este recurso"
            hint="Vacío = ningún servicio"
            empty="No hay servicios activos."
            options={activeServices}
            selected={form.serviceIds}
            onToggle={(id) => {
              setForm((f) => ({ ...f, serviceIds: toggle(f.serviceIds, id) }));
            }}
          />
          <CheckboxGroup
            title="Proveedores elegibles"
            hint="Vacío = cualquier proveedor"
            empty="No hay proveedores activos."
            options={activeProviders}
            selected={form.employeeIds}
            onToggle={(id) => {
              setForm((f) => ({ ...f, employeeIds: toggle(f.employeeIds, id) }));
            }}
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={submitting}
            style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
          >
            {editingId === null ? <Plus size={16} aria-hidden /> : <Save size={16} aria-hidden />}
            {submitting ? "Guardando…" : editingId === null ? "Crear recurso" : "Guardar cambios"}
          </button>
        </div>
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
              <th style={CELL}>Uds.</th>
              <th style={CELL}>Ubicaciones</th>
              <th style={CELL}>Servicios</th>
              <th style={CELL}>Proveedores elegibles</th>
              <th style={CELL}>Estado</th>
              <th style={CELL}></th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id}>
                <td style={CELL}>{r.name}</td>
                <td style={CELL}>{r.quantity}</td>
                <td style={CELL}>
                  <Chips
                    values={r.locationIds.map((id) => nameOf(locations, id))}
                    fallback="Todas"
                  />
                </td>
                <td style={CELL}>
                  <Chips
                    values={r.serviceIds.map((id) => nameOf(services, id))}
                    fallback="Ninguno"
                  />
                </td>
                <td style={CELL}>
                  <Chips
                    values={r.employeeIds.map((id) => nameOf(providers, id))}
                    fallback="Cualquiera"
                  />
                </td>
                <td style={CELL}>
                  <StatusBadge active={r.active} />
                </td>
                <td style={{ ...CELL, textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => {
                      startEdit(r);
                    }}
                    style={{ height: 30, padding: "0 var(--ui-space-3)", marginRight: 6 }}
                  >
                    Editar
                  </button>
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

function CheckboxGroup(props: {
  title: string;
  hint: string;
  empty: string;
  options: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset
      style={{
        border: "1px solid var(--ui-color-border)",
        borderRadius: "var(--ui-radius-md)",
        padding: "var(--ui-space-3)",
        margin: 0,
      }}
    >
      <legend style={{ fontWeight: 600, fontSize: "var(--ui-text-sm)" }}>{props.title}</legend>
      <p
        style={{
          color: "var(--ui-color-text-muted)",
          fontSize: "var(--ui-text-sm)",
          margin: "0 0 var(--ui-space-2)",
        }}
      >
        {props.hint}
      </p>
      {props.options.length === 0 ? (
        <p style={{ color: "var(--ui-color-text-muted)", fontSize: "var(--ui-text-sm)" }}>
          {props.empty}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ui-space-1)" }}>
          {props.options.map((o) => (
            <label
              key={o.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--ui-space-2)",
                fontWeight: 400,
              }}
            >
              <input
                type="checkbox"
                checked={props.selected.includes(o.id)}
                onChange={() => {
                  props.onToggle(o.id);
                }}
              />
              {o.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function Chips(props: { values: string[]; fallback: string }) {
  if (props.values.length === 0) {
    return <span style={{ color: "var(--ui-color-text-muted)" }}>{props.fallback}</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {props.values.map((v) => (
        <span
          key={v}
          style={{
            padding: "1px var(--ui-space-2)",
            borderRadius: "var(--ui-radius-sm)",
            fontSize: "var(--ui-text-sm)",
            background: "var(--ui-color-bg)",
            border: "1px solid var(--ui-color-border)",
          }}
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function StatusBadge(props: { active: boolean }) {
  return (
    <span
      style={{
        padding: "2px var(--ui-space-2)",
        borderRadius: "var(--ui-radius-sm)",
        fontSize: "var(--ui-text-sm)",
        fontWeight: 500,
        color: props.active ? "var(--ui-color-success)" : "var(--ui-color-text-muted)",
        background: props.active ? "#e7f6ec" : "var(--ui-color-bg)",
      }}
    >
      {props.active ? "Activo" : "Inactivo"}
    </span>
  );
}
