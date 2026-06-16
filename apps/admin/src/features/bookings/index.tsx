"use client";

/**
 * Reservas screen. Creates a booking by chaining the assignment model:
 * service -> provider (only those who deliver it) -> customer -> start time.
 * The store rejects the booking if the provider is not eligible for the
 * service's resource, does not work at its location, the resource is at
 * capacity, or the provider is already busy. Talks to /api/bookings,
 * /api/services, /api/providers and /api/customers.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Plus, RefreshCw, X } from "lucide-react";
import { formatDateTime, formatMoney } from "@/lib/format";

interface AdminService {
  id: string;
  name: string;
  active: boolean;
}
interface AdminProvider {
  id: string;
  name: string;
  serviceIds: string[];
  active: boolean;
}
interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  active: boolean;
}
interface AdminBooking {
  id: string;
  serviceId: string;
  serviceName: string;
  providerId: string;
  providerName: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  startAt: string;
  endAt: string;
  status: "confirmed" | "cancelled";
  priceAmount: number;
  currency: string;
}

const CELL: React.CSSProperties = {
  padding: "var(--ui-space-3)",
  borderBottom: "1px solid var(--ui-color-border)",
  textAlign: "left",
  verticalAlign: "top",
};

export function Bookings() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serviceId, setServiceId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeServices = useMemo(() => services.filter((s) => s.active), [services]);
  const activeCustomers = useMemo(() => customers.filter((c) => c.active), [customers]);
  // Only providers who are active and deliver the selected service.
  const eligibleProviders = useMemo(
    () => providers.filter((p) => p.active && p.serviceIds.includes(serviceId)),
    [providers, serviceId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, sRes, pRes, cRes] = await Promise.all([
        fetch("/api/bookings"),
        fetch("/api/services"),
        fetch("/api/providers"),
        fetch("/api/customers"),
      ]);
      if (!bRes.ok || !sRes.ok || !pRes.ok || !cRes.ok) {
        throw new Error("No se pudo cargar la información de reservas.");
      }
      setBookings(((await bRes.json()) as { items: AdminBooking[] }).items);
      setServices(((await sRes.json()) as { items: AdminService[] }).items);
      setProviders(((await pRes.json()) as { items: AdminProvider[] }).items);
      setCustomers(((await cRes.json()) as { items: AdminCustomer[] }).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Default the service selector to the first active service once loaded.
  useEffect(() => {
    if (serviceId === "" && activeServices.length > 0) {
      setServiceId(activeServices[0]?.id ?? "");
    }
  }, [activeServices, serviceId]);

  // Keep the provider selection valid for the chosen service.
  useEffect(() => {
    if (!eligibleProviders.some((p) => p.id === providerId)) {
      setProviderId(eligibleProviders[0]?.id ?? "");
    }
  }, [eligibleProviders, providerId]);

  // Default the customer selector to the first active customer.
  useEffect(() => {
    if (customerId === "" && activeCustomers.length > 0) {
      setCustomerId(activeCustomers[0]?.id ?? "");
    }
  }, [activeCustomers, customerId]);

  async function handleCreate(event: { preventDefault(): void }) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId,
          providerId,
          customerId,
          startAt: new Date(startAt).toISOString(),
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Creación falló con ${String(res.status)}`);
      }
      setStartAt("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(booking: AdminBooking) {
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `Cancelación falló con ${String(res.status)}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  const canSubmit =
    serviceId !== "" && providerId !== "" && customerId !== "" && startAt !== "" && !submitting;

  return (
    <section>
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
        <CalendarCheck size={20} aria-hidden />
        Reservas
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 680 }}>
        Agenda de citas del tenant. Elige servicio, proveedor (solo los que lo prestan) y cliente.
        La reserva se rechaza si el proveedor no es elegible para el recurso, no trabaja en su
        ubicación, no hay capacidad o el proveedor ya está ocupado.
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
          Servicio
          <select
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
            }}
            required
            style={{ minWidth: 200 }}
          >
            {activeServices.length === 0 && <option value="">No hay servicios activos</option>}
            {activeServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Proveedor
          <select
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value);
            }}
            required
            style={{ minWidth: 180 }}
          >
            {eligibleProviders.length === 0 && (
              <option value="">Ningún proveedor presta este servicio</option>
            )}
            {eligibleProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
            }}
            required
            style={{ minWidth: 200 }}
          >
            {activeCustomers.length === 0 && <option value="">No hay clientes</option>}
            {activeCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
        </label>
        <label>
          Inicio
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => {
              setStartAt(e.target.value);
            }}
            required
          />
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
        >
          <Plus size={16} aria-hidden />
          {submitting ? "Creando…" : "Crear reserva"}
        </button>
      </form>

      {error !== null && (
        <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2>Agenda</h2>
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
      ) : bookings.length === 0 ? (
        <p style={{ color: "var(--ui-color-text-muted)" }}>
          Aún no hay reservas. Crea la primera arriba.
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
              <th style={CELL}>Inicio</th>
              <th style={CELL}>Servicio</th>
              <th style={CELL}>Proveedor</th>
              <th style={CELL}>Cliente</th>
              <th style={CELL}>Importe</th>
              <th style={CELL}>Estado</th>
              <th style={CELL}></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td style={CELL}>{formatDateTime(b.startAt)}</td>
                <td style={CELL}>{b.serviceName}</td>
                <td style={CELL}>{b.providerName}</td>
                <td style={CELL}>
                  <div>{b.customerName}</div>
                  <div
                    style={{ color: "var(--ui-color-text-muted)", fontSize: "var(--ui-text-sm)" }}
                  >
                    {b.customerEmail}
                  </div>
                </td>
                <td style={CELL}>{formatMoney(b.priceAmount, b.currency)}</td>
                <td style={CELL}>
                  <span
                    style={{
                      padding: "2px var(--ui-space-2)",
                      borderRadius: "var(--ui-radius-sm)",
                      fontSize: "var(--ui-text-sm)",
                      fontWeight: 500,
                      color:
                        b.status === "confirmed"
                          ? "var(--ui-color-success)"
                          : "var(--ui-color-danger)",
                      background: b.status === "confirmed" ? "#e7f6ec" : "#fdeaea",
                    }}
                  >
                    {b.status === "confirmed" ? "Confirmada" : "Cancelada"}
                  </span>
                </td>
                <td style={{ ...CELL, textAlign: "right" }}>
                  {b.status === "confirmed" && (
                    <button
                      onClick={() => void cancel(b)}
                      style={{
                        height: 30,
                        padding: "0 var(--ui-space-3)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "var(--ui-space-1)",
                      }}
                    >
                      <X size={14} aria-hidden />
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
