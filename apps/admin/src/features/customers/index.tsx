"use client";

/**
 * Clientes screen. Simple CRUD over the tenant's customer registry. Customers
 * are first-class so a booking links to one (instead of inline name/email).
 * Talks to /api/customers.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useState } from "react";
import { Contact, Plus, RefreshCw } from "lucide-react";

interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  active: boolean;
  createdAt: string;
}

const CELL: React.CSSProperties = {
  padding: "var(--ui-space-3)",
  borderBottom: "1px solid var(--ui-color-border)",
  textAlign: "left",
};

export function Customers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers");
      if (!res.ok) {
        throw new Error("No se pudo cargar clientes.");
      }
      setCustomers(((await res.json()) as { items: AdminCustomer[] }).items);
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
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Creación falló con ${String(res.status)}`);
      }
      setName("");
      setEmail("");
      setPhone("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(customer: AdminCustomer) {
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !customer.active }),
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
        <Contact size={20} aria-hidden />
        Clientes
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 640 }}>
        Registro de clientes del tenant. Al crear una reserva se selecciona un cliente de esta
        lista.
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
            placeholder="Nombre y apellidos"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            required
            placeholder="cliente@example.com"
          />
        </label>
        <label>
          Teléfono
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
            }}
            placeholder="+34 600 000 000"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
        >
          <Plus size={16} aria-hidden />
          {submitting ? "Creando…" : "Crear cliente"}
        </button>
      </form>

      {error !== null && (
        <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2>Cartera</h2>
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
      ) : customers.length === 0 ? (
        <p style={{ color: "var(--ui-color-text-muted)" }}>
          Aún no hay clientes. Crea el primero arriba.
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
              <th style={CELL}>Cliente</th>
              <th style={CELL}>Email</th>
              <th style={CELL}>Teléfono</th>
              <th style={CELL}>Estado</th>
              <th style={CELL}></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td style={CELL}>{c.name}</td>
                <td style={CELL}>{c.email}</td>
                <td style={CELL}>{c.phone ?? "—"}</td>
                <td style={CELL}>
                  <span
                    style={{
                      padding: "2px var(--ui-space-2)",
                      borderRadius: "var(--ui-radius-sm)",
                      fontSize: "var(--ui-text-sm)",
                      fontWeight: 500,
                      color: c.active ? "var(--ui-color-success)" : "var(--ui-color-text-muted)",
                      background: c.active ? "#e7f6ec" : "var(--ui-color-bg)",
                    }}
                  >
                    {c.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td style={{ ...CELL, textAlign: "right" }}>
                  <button
                    onClick={() => void toggleActive(c)}
                    style={{ height: 30, padding: "0 var(--ui-space-3)" }}
                  >
                    {c.active ? "Desactivar" : "Activar"}
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
