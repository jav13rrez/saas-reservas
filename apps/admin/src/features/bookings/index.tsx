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

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, CreditCard, Plus, RefreshCw, X } from "lucide-react";
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

type BookingStatus = "pending" | "approved" | "rejected" | "canceled" | "completed" | "no_show";

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
  status: BookingStatus;
  priceAmount: number;
  currency: string;
}

type ManualPaymentMethod = "cash" | "card" | "bank_transfer" | "other";
type ManualPaymentStatus = "paid" | "partial" | "not_paid";

interface ManualPayment {
  bookingId: string;
  method: ManualPaymentMethod;
  status: ManualPaymentStatus;
  amount: number;
  deposit: number;
  currency: string;
  transactionRef?: string;
  notes?: string;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  canceled: "Cancelada",
  completed: "Completada",
  no_show: "No-show",
};

/** Status color mapping per docs/design-system.md; completed/no_show follow the
 * same success/danger convention (positive vs. negative operational outcome). */
const STATUS_COLOR: Record<BookingStatus, { color: string; background: string }> = {
  pending: { color: "var(--ui-color-warning)", background: "#fdf3e7" },
  approved: { color: "var(--ui-color-success)", background: "#e7f6ec" },
  rejected: { color: "var(--ui-color-danger)", background: "#fdeaea" },
  canceled: { color: "var(--ui-color-text-muted)", background: "var(--ui-color-bg)" },
  completed: { color: "var(--ui-color-success)", background: "#e7f6ec" },
  no_show: { color: "var(--ui-color-danger)", background: "#fdeaea" },
};

/** Next statuses reachable from each status, mirroring the domain state machine. */
const NEXT_STATUSES: Record<BookingStatus, BookingStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["canceled", "completed", "no_show"],
  rejected: [],
  canceled: [],
  completed: [],
  no_show: [],
};

const ACTION_LABEL: Record<BookingStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobar",
  rejected: "Rechazar",
  canceled: "Cancelar",
  completed: "Completar",
  no_show: "No-show",
};

const PAYMENT_METHOD_LABEL: Record<ManualPaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  bank_transfer: "Transferencia",
  other: "Otro",
};
const PAYMENT_STATUS_LABEL: Record<ManualPaymentStatus, string> = {
  paid: "Pagado",
  partial: "Parcial",
  not_paid: "No pagado",
};

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

  async function transition(booking: AdminBooking, to: BookingStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `La transición falló con ${String(res.status)}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  const canSubmit =
    serviceId !== "" && providerId !== "" && customerId !== "" && startAt !== "" && !submitting;

  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("cash");
  const [paymentStatus, setPaymentStatus] = useState<ManualPaymentStatus>("paid");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDeposit, setPaymentDeposit] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  async function togglePayment(booking: AdminBooking) {
    if (paymentBookingId === booking.id) {
      setPaymentBookingId(null);
      return;
    }
    setPaymentBookingId(booking.id);
    setPaymentError(null);
    setPaymentSaved(false);
    setPaymentLoading(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/payment`);
      if (!res.ok) {
        throw new Error(`No se pudo cargar el pago (${String(res.status)}).`);
      }
      const loaded = (await res.json()) as ManualPayment | null;
      setPaymentMethod(loaded?.method ?? "cash");
      setPaymentStatus(loaded?.status ?? "paid");
      setPaymentAmount(loaded !== null ? String(loaded.amount / 100) : "");
      setPaymentDeposit(loaded !== null ? String(loaded.deposit / 100) : "");
      setPaymentRef(loaded?.transactionRef ?? "");
      setPaymentNotes(loaded?.notes ?? "");
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function savePayment(booking: AdminBooking) {
    setPaymentSaving(true);
    setPaymentError(null);
    setPaymentSaved(false);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/payment`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: paymentMethod,
          status: paymentStatus,
          amount: Math.round(Number(paymentAmount || "0") * 100),
          deposit: Math.round(Number(paymentDeposit || "0") * 100),
          currency: booking.currency,
          ...(paymentRef.trim() !== "" ? { transactionRef: paymentRef.trim() } : {}),
          ...(paymentNotes.trim() !== "" ? { notes: paymentNotes.trim() } : {}),
        }),
      });
      const body = (await res.json()) as ManualPayment | { error?: string };
      if (!res.ok) {
        throw new Error(
          (body as { error?: string }).error ?? `El guardado falló (${String(res.status)}).`,
        );
      }
      setPaymentSaved(true);
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setPaymentSaving(false);
    }
  }

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
              <Fragment key={b.id}>
                <tr>
                  <td style={CELL}>{formatDateTime(b.startAt)}</td>
                  <td style={CELL}>{b.serviceName}</td>
                  <td style={CELL}>{b.providerName}</td>
                  <td style={CELL}>
                    <div>{b.customerName}</div>
                    <div
                      style={{
                        color: "var(--ui-color-text-muted)",
                        fontSize: "var(--ui-text-sm)",
                      }}
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
                        color: STATUS_COLOR[b.status].color,
                        background: STATUS_COLOR[b.status].background,
                      }}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td style={{ ...CELL, textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "var(--ui-space-2)",
                      }}
                    >
                      {NEXT_STATUSES[b.status].map((next) => (
                        <button
                          key={next}
                          onClick={() => void transition(b, next)}
                          style={{
                            height: 30,
                            padding: "0 var(--ui-space-3)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "var(--ui-space-1)",
                          }}
                        >
                          {next === "approved" ? (
                            <Check size={14} aria-hidden />
                          ) : (
                            <X size={14} aria-hidden />
                          )}
                          {ACTION_LABEL[next]}
                        </button>
                      ))}
                      <button
                        onClick={() => void togglePayment(b)}
                        style={{
                          height: 30,
                          padding: "0 var(--ui-space-3)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "var(--ui-space-1)",
                        }}
                      >
                        <CreditCard size={14} aria-hidden />
                        Pago
                      </button>
                    </div>
                  </td>
                </tr>
                {paymentBookingId === b.id && (
                  <tr>
                    <td colSpan={7} style={{ ...CELL, background: "var(--ui-color-bg)" }}>
                      {paymentLoading ? (
                        <p role="status">Cargando pago…</p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "flex-end",
                            gap: "var(--ui-space-3)",
                          }}
                        >
                          <label>
                            Método
                            <select
                              value={paymentMethod}
                              onChange={(e) => {
                                setPaymentMethod(e.target.value as ManualPaymentMethod);
                              }}
                            >
                              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Estado
                            <select
                              value={paymentStatus}
                              onChange={(e) => {
                                setPaymentStatus(e.target.value as ManualPaymentStatus);
                              }}
                            >
                              {Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Importe ({b.currency})
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={paymentAmount}
                              onChange={(e) => {
                                setPaymentAmount(e.target.value);
                              }}
                              style={{ width: 120 }}
                            />
                          </label>
                          <label>
                            Depósito ({b.currency})
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={paymentDeposit}
                              onChange={(e) => {
                                setPaymentDeposit(e.target.value);
                              }}
                              style={{ width: 120 }}
                            />
                          </label>
                          <label>
                            Referencia
                            <input
                              type="text"
                              value={paymentRef}
                              onChange={(e) => {
                                setPaymentRef(e.target.value);
                              }}
                              style={{ width: 160 }}
                            />
                          </label>
                          <label>
                            Notas
                            <input
                              type="text"
                              value={paymentNotes}
                              onChange={(e) => {
                                setPaymentNotes(e.target.value);
                              }}
                              style={{ width: 200 }}
                            />
                          </label>
                          <button
                            onClick={() => void savePayment(b)}
                            disabled={paymentSaving}
                            style={{ height: 36, padding: "0 var(--ui-space-4)" }}
                          >
                            {paymentSaving ? "Guardando…" : "Guardar pago"}
                          </button>
                          {paymentSaved && (
                            <span style={{ color: "var(--ui-color-success)" }}>Guardado.</span>
                          )}
                          {paymentError !== null && (
                            <span role="alert" style={{ color: "var(--ui-color-danger)" }}>
                              {paymentError}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
