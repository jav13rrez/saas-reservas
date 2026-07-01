"use client";

/**
 * Reservas screen. Creates a booking by chaining the assignment model:
 * service -> provider (only those who deliver it) -> customer -> start time.
 * The store rejects the booking if the provider is not eligible for the
 * service's resource, does not work at its location, the resource is at
 * capacity, or the provider is already busy. Talks to /api/bookings,
 * /api/services, /api/providers and /api/customers.
 *
 * Feature 004 (ciclo de estados y pagos manuales): the booking lifecycle has
 * 6 states (pending/approved/rejected/canceled/completed/no_show, mirroring
 * `packages/domain/src/bookings/booking.ts`). Per-row actions only offer the
 * transitions valid from the current state (Aprobar/Rechazar from pending;
 * Completar/No-show from approved); everything else is terminal. Expanding a
 * row also reveals the manual payment section (método/estado/importe/
 * depósito/referencia/notas), independent of the online gateway.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarCheck,
  CalendarX,
  CheckCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  RefreshCw,
  UserX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
type LifecycleAction = "approve" | "reject" | "complete" | "no-show";

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

const METHOD_LABEL: Record<ManualPaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  bank_transfer: "Transferencia",
  other: "Otro",
};

const PAYMENT_STATUS_LABEL: Record<ManualPaymentStatus, string> = {
  paid: "Pagado",
  partial: "Parcial",
  not_paid: "Sin pagar",
};

/**
 * Badge palette (tokens only, no hardcoded hex): pending = warning, approved
 * = success, completed = primary (distinct from approved — this separates
 * "confirmed and upcoming" from "actually happened"), rejected and no_show =
 * danger (both are failure-shaped outcomes for the business), canceled =
 * muted (a client/staff decision, not a failure).
 */
const STATUS_STYLE: Record<BookingStatus, { label: string; color: string; icon: LucideIcon }> = {
  pending: { label: "Pendiente", color: "var(--ui-color-warning)", icon: Clock },
  approved: { label: "Aprobada", color: "var(--ui-color-success)", icon: CheckCircle2 },
  completed: { label: "Completada", color: "var(--ui-color-primary)", icon: CheckCheck },
  rejected: { label: "Rechazada", color: "var(--ui-color-danger)", icon: Ban },
  canceled: { label: "Cancelada", color: "var(--ui-color-text-muted)", icon: CalendarX },
  no_show: { label: "No-show", color: "var(--ui-color-danger)", icon: UserX },
};

/** Mirrors the domain TRANSITIONS reachable from the admin console's row actions. */
const NEXT_ACTIONS: Record<
  BookingStatus,
  readonly { action: LifecycleAction; label: string; icon: LucideIcon }[]
> = {
  pending: [
    { action: "approve", label: "Aprobar", icon: CheckCircle2 },
    { action: "reject", label: "Rechazar", icon: Ban },
  ],
  approved: [
    { action: "complete", label: "Completar", icon: CheckCheck },
    { action: "no-show", label: "No-show", icon: UserX },
  ],
  rejected: [],
  canceled: [],
  completed: [],
  no_show: [],
};

const CELL: React.CSSProperties = {
  padding: "var(--ui-space-3)",
  borderBottom: "1px solid var(--ui-color-border)",
  textAlign: "left",
  verticalAlign: "top",
};

function StatusBadge({ status }: { status: BookingStatus }) {
  const style = STATUS_STYLE[status];
  const Icon = style.icon;
  return (
    <span
      style={{
        padding: "2px var(--ui-space-2)",
        borderRadius: "var(--ui-radius-sm)",
        fontSize: "var(--ui-text-sm)",
        fontWeight: 500,
        color: style.color,
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--ui-space-1)",
        border: `1px solid ${style.color}`,
      }}
    >
      <Icon size={12} aria-hidden />
      {style.label}
    </span>
  );
}

interface PaymentFormState {
  method: ManualPaymentMethod;
  status: ManualPaymentStatus;
  amount: string;
  deposit: string;
  transactionRef: string;
  notes: string;
}

function emptyPaymentForm(): PaymentFormState {
  return {
    method: "cash",
    status: "not_paid",
    amount: "0",
    deposit: "0",
    transactionRef: "",
    notes: "",
  };
}

function paymentToForm(payment: ManualPayment): PaymentFormState {
  return {
    method: payment.method,
    status: payment.status,
    amount: String(payment.amount / 100),
    deposit: String(payment.deposit / 100),
    transactionRef: payment.transactionRef ?? "",
    notes: payment.notes ?? "",
  };
}

/** Payment section for one booking row: loads on expand, upserts on save. */
function PaymentSection({ booking }: { booking: AdminBooking }) {
  const [form, setForm] = useState<PaymentFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const state = { cancelled: false };
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/bookings/${booking.id}/payment`);
        if (!res.ok) {
          throw new Error("No se pudo cargar el pago.");
        }
        const payment = (await res.json()) as ManualPayment | null;
        if (!state.cancelled) {
          setForm(payment === null ? emptyPaymentForm() : paymentToForm(payment));
        }
      } catch (e) {
        if (!state.cancelled) {
          setError(e instanceof Error ? e.message : "Error inesperado");
        }
      } finally {
        if (!state.cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      state.cancelled = true;
    };
  }, [booking.id]);

  async function save(event: { preventDefault(): void }) {
    event.preventDefault();
    if (form === null) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const amount = Math.round(Number(form.amount) * 100);
      const deposit = Math.round(Number(form.deposit) * 100);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("El importe debe ser un número no negativo.");
      }
      if (!Number.isFinite(deposit) || deposit < 0 || deposit > amount) {
        throw new Error("El depósito no puede ser negativo ni superar el importe.");
      }
      const res = await fetch(`/api/bookings/${booking.id}/payment`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: form.method,
          status: form.status,
          amount,
          deposit,
          currency: booking.currency,
          transactionRef: form.transactionRef,
          notes: form.notes,
        }),
      });
      const body = (await res.json()) as ManualPayment | { error?: string };
      if (!res.ok) {
        throw new Error((body as { error?: string }).error ?? "No se pudo guardar el pago.");
      }
      setForm(paymentToForm(body as ManualPayment));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  if (loading || form === null) {
    return (
      <p role="status" style={{ color: "var(--ui-color-text-muted)" }}>
        Cargando pago…
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => void save(e)}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--ui-space-3)",
        alignItems: "flex-end",
      }}
    >
      <label>
        Método
        <select
          value={form.method}
          onChange={(e) => {
            setForm({ ...form, method: e.target.value as ManualPaymentMethod });
          }}
        >
          {Object.entries(METHOD_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Estado de pago
        <select
          value={form.status}
          onChange={(e) => {
            setForm({ ...form, status: e.target.value as ManualPaymentStatus });
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
        Importe ({booking.currency})
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          onChange={(e) => {
            setForm({ ...form, amount: e.target.value });
          }}
          style={{ width: 120 }}
        />
      </label>
      <label>
        Depósito ({booking.currency})
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.deposit}
          onChange={(e) => {
            setForm({ ...form, deposit: e.target.value });
          }}
          style={{ width: 120 }}
        />
      </label>
      <label>
        Referencia
        <input
          type="text"
          value={form.transactionRef}
          onChange={(e) => {
            setForm({ ...form, transactionRef: e.target.value });
          }}
          style={{ width: 160 }}
        />
      </label>
      <label style={{ flexBasis: "100%" }}>
        Notas
        <input
          type="text"
          value={form.notes}
          onChange={(e) => {
            setForm({ ...form, notes: e.target.value });
          }}
          style={{ width: "100%", minWidth: 240 }}
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
      >
        <CreditCard size={14} aria-hidden />
        {saving ? "Guardando…" : "Guardar pago"}
      </button>
      {saved && (
        <span style={{ color: "var(--ui-color-success)", fontSize: "var(--ui-text-sm)" }}>
          Guardado.
        </span>
      )}
      {error !== null && (
        <p role="alert" style={{ color: "var(--ui-color-danger)", flexBasis: "100%", margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  );
}

export function Bookings() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

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

  async function runAction(booking: AdminBooking, action: LifecycleAction) {
    setError(null);
    setActionPending(`${booking.id}:${action}`);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `La acción falló con ${String(res.status)}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setActionPending(null);
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
            {bookings.map((b) => {
              const actions = NEXT_ACTIONS[b.status];
              const expanded = expandedId === b.id;
              const canCancel = b.status !== "canceled" && b.status !== "rejected";
              return (
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
                      <StatusBadge status={b.status} />
                    </td>
                    <td style={{ ...CELL, textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: "var(--ui-space-2)",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        {actions.map((action) => {
                          const Icon = action.icon;
                          const key = `${b.id}:${action.action}`;
                          return (
                            <button
                              key={action.action}
                              onClick={() => void runAction(b, action.action)}
                              disabled={actionPending === key}
                              style={{
                                height: 30,
                                padding: "0 var(--ui-space-3)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "var(--ui-space-1)",
                              }}
                            >
                              <Icon size={14} aria-hidden />
                              {action.label}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => {
                            setExpandedId(expanded ? null : b.id);
                          }}
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
                        {canCancel && (
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
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={7} style={{ ...CELL, background: "var(--ui-color-bg)" }}>
                        <PaymentSection booking={b} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
