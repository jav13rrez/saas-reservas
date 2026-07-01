"use client";

/**
 * Calendario screen. A weekly grid of approved bookings grouped by provider:
 * one row per provider, one column per day. Each cell lists that provider's
 * bookings that day (time + service + customer). Navigate weeks with the
 * arrows. Talks to /api/bookings and /api/providers.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

interface AdminProvider {
  id: string;
  name: string;
  active: boolean;
}
interface AdminBooking {
  id: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  customerName: string;
  startAt: string;
  endAt: string;
  status: "pending" | "approved" | "rejected" | "canceled" | "completed" | "no_show";
}

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Monday 00:00 of the week containing `ref`. */
function startOfWeek(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const weekday = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - weekday);
  return d;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

const CELL: React.CSSProperties = {
  padding: "var(--ui-space-2)",
  border: "1px solid var(--ui-color-border)",
  verticalAlign: "top",
  minWidth: 130,
};

export function Calendar() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, pRes] = await Promise.all([fetch("/api/bookings"), fetch("/api/providers")]);
      if (!bRes.ok || !pRes.ok) {
        throw new Error("No se pudo cargar el calendario.");
      }
      setBookings(((await bRes.json()) as { items: AdminBooking[] }).items);
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

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  // Confirmed bookings within the visible week.
  const weekBookings = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.status !== "approved") {
          return false;
        }
        const start = new Date(b.startAt);
        return start >= weekStart && start < weekEnd;
      }),
    [bookings, weekStart, weekEnd],
  );

  // Providers that either are active or have a booking this week (so cancelled
  // assignments still show their history).
  const rows = useMemo(() => {
    const withBookings = new Set(weekBookings.map((b) => b.providerId));
    return providers.filter((p) => p.active || withBookings.has(p.id));
  }, [providers, weekBookings]);

  function bookingsFor(providerId: string, day: Date): AdminBooking[] {
    return weekBookings
      .filter((b) => b.providerId === providerId && sameDay(new Date(b.startAt), day))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  const rangeLabel = `${weekStart.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  })} – ${addDays(weekStart, 6).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;

  const today = new Date();

  return (
    <section>
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
        <CalendarDays size={20} aria-hidden />
        Calendario
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 640 }}>
        Vista semanal de reservas confirmadas por proveedor. Cada celda muestra las citas de ese
        profesional ese día.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--ui-space-3)",
          margin: "var(--ui-space-5) 0",
        }}
      >
        <button
          onClick={() => {
            setWeekStart((w) => addDays(w, -7));
          }}
          aria-label="Semana anterior"
          style={{ display: "inline-flex", alignItems: "center", height: 32 }}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <button
          onClick={() => {
            setWeekStart(startOfWeek(new Date()));
          }}
          style={{ height: 32, padding: "0 var(--ui-space-3)" }}
        >
          Hoy
        </button>
        <button
          onClick={() => {
            setWeekStart((w) => addDays(w, 7));
          }}
          aria-label="Semana siguiente"
          style={{ display: "inline-flex", alignItems: "center", height: 32 }}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
        <strong style={{ marginLeft: "var(--ui-space-2)" }}>{rangeLabel}</strong>
        <button
          onClick={() => void load()}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--ui-space-2)",
            height: 32,
          }}
        >
          <RefreshCw size={14} aria-hidden />
          Actualizar
        </button>
      </div>

      {error !== null && (
        <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      )}

      {loading ? (
        <p role="status">Cargando…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ui-color-text-muted)" }}>
          No hay proveedores que mostrar. Crea proveedores en su área.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "var(--ui-color-surface)",
              fontSize: "var(--ui-text-sm)",
            }}
          >
            <thead>
              <tr style={{ color: "var(--ui-color-text-muted)" }}>
                <th style={{ ...CELL, minWidth: 140, textAlign: "left" }}>Proveedor</th>
                {days.map((day, i) => (
                  <th
                    key={day.toISOString()}
                    style={{
                      ...CELL,
                      textAlign: "left",
                      background: sameDay(day, today)
                        ? "var(--ui-color-primary-soft)"
                        : "var(--ui-color-bg)",
                    }}
                  >
                    {DAY_NAMES[i]} {day.getDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...CELL, fontWeight: 600 }}>{p.name}</td>
                  {days.map((day) => {
                    const cellBookings = bookingsFor(p.id, day);
                    return (
                      <td
                        key={day.toISOString()}
                        style={{
                          ...CELL,
                          background: sameDay(day, today) ? "#f5f9ff" : undefined,
                        }}
                      >
                        {cellBookings.length === 0 ? (
                          <span style={{ color: "var(--ui-color-text-muted)" }}>—</span>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "var(--ui-space-1)",
                            }}
                          >
                            {cellBookings.map((b) => (
                              <div
                                key={b.id}
                                style={{
                                  padding: "var(--ui-space-1) var(--ui-space-2)",
                                  borderRadius: "var(--ui-radius-sm)",
                                  background: "var(--ui-color-primary-soft)",
                                  borderLeft: "3px solid var(--ui-color-primary)",
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>
                                  {timeOf(b.startAt)} {b.serviceName}
                                </div>
                                <div style={{ color: "var(--ui-color-text-muted)" }}>
                                  {b.customerName}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
