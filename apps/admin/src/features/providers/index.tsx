"use client";

/**
 * Proveedores screen. A provider (the human delivering the service) is assigned
 * to locations and the services they deliver. Resource eligibility is now
 * configured from the resource side (hub model), not here. Talks to
 * /api/providers, /api/locations and /api/services.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCog, Plus, RefreshCw, Save, X } from "lucide-react";

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
  email: string;
  timezone?: string;
  locationIds: string[];
  serviceIds: string[];
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
    email: "",
    timezone: "Europe/Madrid",
    locationIds: [] as string[],
    serviceIds: [] as string[],
  };
}

export function Providers() {
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const activeLocations = useMemo(() => locations.filter((l) => l.active), [locations]);
  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);

  const nameOf = useCallback(
    (items: { id: string; name: string }[], id: string) =>
      items.find((i) => i.id === id)?.name ?? id,
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, lRes, sRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/locations"),
        fetch("/api/services"),
      ]);
      if (!pRes.ok || !lRes.ok || !sRes.ok) {
        throw new Error("No se pudo cargar la información de proveedores.");
      }
      setProviders(((await pRes.json()) as { items: AdminProvider[] }).items);
      setLocations(((await lRes.json()) as { items: AdminLocation[] }).items);
      setServices(((await sRes.json()) as { items: AdminService[] }).items);
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

  function startEdit(p: AdminProvider) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      email: p.email,
      timezone: p.timezone ?? "",
      locationIds: [...p.locationIds],
      serviceIds: [...p.serviceIds],
    });
  }

  async function handleSubmit(event: { preventDefault(): void }) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = editingId === null ? "/api/providers" : `/api/providers/${editingId}`;
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

  async function toggleActive(p: AdminProvider) {
    setError(null);
    try {
      const res = await fetch(`/api/providers/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
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
        <UserCog size={20} aria-hidden />
        Proveedores
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 680 }}>
        El profesional que presta el servicio. Asígnale sus ubicaciones y los servicios que ofrece.
        La elegibilidad sobre recursos físicos (salas, equipos) se configura desde la pantalla de
        Recursos.
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
          <strong>{editingId === null ? "Nuevo proveedor" : "Editar proveedor"}</strong>
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
              placeholder="Ana Torres"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }));
              }}
              required
              placeholder="ana@example.com"
            />
          </label>
          <label>
            Zona horaria
            <input
              value={form.timezone}
              onChange={(e) => {
                setForm((f) => ({ ...f, timezone: e.target.value }));
              }}
              placeholder="Europe/Madrid"
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
            empty="No hay ubicaciones activas."
            options={activeLocations}
            selected={form.locationIds}
            onToggle={(id) => {
              setForm((f) => ({ ...f, locationIds: toggle(f.locationIds, id) }));
            }}
          />
          <CheckboxGroup
            title="Servicios que presta"
            empty="No hay servicios activos."
            options={activeServices}
            selected={form.serviceIds}
            onToggle={(id) => {
              setForm((f) => ({ ...f, serviceIds: toggle(f.serviceIds, id) }));
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
            {submitting ? "Guardando…" : editingId === null ? "Crear proveedor" : "Guardar cambios"}
          </button>
        </div>
      </form>

      {error !== null && (
        <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2>Equipo</h2>
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
      ) : providers.length === 0 ? (
        <p style={{ color: "var(--ui-color-text-muted)" }}>
          Aún no hay proveedores. Crea el primero arriba.
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
              <th style={CELL}>Proveedor</th>
              <th style={CELL}>Ubicaciones</th>
              <th style={CELL}>Servicios</th>
              <th style={CELL}>Estado</th>
              <th style={CELL}></th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td style={CELL}>
                  <div>{p.name}</div>
                  <div
                    style={{ color: "var(--ui-color-text-muted)", fontSize: "var(--ui-text-sm)" }}
                  >
                    {p.email}
                  </div>
                </td>
                <td style={CELL}>
                  <Chips
                    values={p.locationIds.map((id) => nameOf(locations, id))}
                    fallback="Todas"
                  />
                </td>
                <td style={CELL}>
                  <Chips values={p.serviceIds.map((id) => nameOf(services, id))} fallback="—" />
                </td>
                <td style={CELL}>
                  <StatusBadge active={p.active} />
                </td>
                <td style={{ ...CELL, textAlign: "right", whiteSpace: "nowrap" }}>
                  <a
                    href={`/providers/${p.id}/schedule`}
                    style={{
                      display: "inline-block",
                      height: 30,
                      lineHeight: "30px",
                      padding: "0 var(--ui-space-3)",
                      marginRight: 6,
                      borderRadius: "var(--ui-radius-sm)",
                      border: "1px solid var(--ui-color-border)",
                      color: "var(--ui-color-text)",
                      textDecoration: "none",
                    }}
                  >
                    Agenda
                  </a>
                  <button
                    onClick={() => {
                      startEdit(p);
                    }}
                    style={{ height: 30, padding: "0 var(--ui-space-3)", marginRight: 6 }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => void toggleActive(p)}
                    style={{ height: 30, padding: "0 var(--ui-space-3)" }}
                  >
                    {p.active ? "Desactivar" : "Activar"}
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
