"use client";

/**
 * Booking widget checkout UI (T040): pick date -> pick slot -> enter contact
 * details -> pay. Provider selection is skipped when the API reports a single
 * active provider (US1 scenario 2); the API enforces locks, pricing, and
 * payment state (US2). Styling and full branding arrive with later tasks.
 */

import { useState } from "react";
import { CalendarDays } from "lucide-react";

interface SubmitEvent {
  preventDefault(): void;
}

interface Slot {
  startAt: string;
  endAt: string;
}

interface WidgetConfig {
  serviceId: string;
  providerSelection: "hidden" | "required";
  providers: { id: string; displayName: string }[];
}

interface CheckoutResult {
  bookingId: string;
  cartId: string;
  status: string;
}

export function Checkout() {
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [providerId, setProviderId] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function loadAvailability(event: SubmitEvent) {
    event.preventDefault();
    setStatus("Buscando disponibilidad…");
    setSelectedSlot(null);
    setResult(null);

    const configResponse = await fetch(`/api/v1/public/widget-config?serviceId=${serviceId}`);
    if (!configResponse.ok) {
      setStatus("Servicio no encontrado.");
      return;
    }
    const widgetConfig = (await configResponse.json()) as WidgetConfig;
    setConfig(widgetConfig);
    if (widgetConfig.providerSelection === "required" && providerId === "") {
      setSlots(null);
      setStatus("Este servicio tiene varios profesionales: elige uno.");
      return;
    }

    const query = new URLSearchParams({ serviceId, date });
    if (widgetConfig.providerSelection === "required") {
      query.set("providerId", providerId);
    }
    const availabilityResponse = await fetch(`/api/v1/public/availability?${query.toString()}`);
    if (!availabilityResponse.ok) {
      setStatus("No se pudo cargar la disponibilidad.");
      return;
    }
    const body = (await availabilityResponse.json()) as { slots: Slot[] };
    setSlots(body.slots);
    setStatus(body.slots.length === 0 ? "Sin huecos para esa fecha." : null);
  }

  async function pay(event: SubmitEvent) {
    event.preventDefault();
    if (selectedSlot === null) {
      return;
    }
    setStatus("Procesando pago…");
    const response = await fetch("/api/v1/public/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId,
        date,
        startAt: selectedSlot.startAt,
        ...(config?.providerSelection === "required" ? { providerId } : {}),
        customer: { email, firstName, lastName },
      }),
    });
    if (response.status === 409) {
      setStatus("Ese hueco acaba de ocuparse. Elige otro.");
      setSelectedSlot(null);
      return;
    }
    if (response.status === 402) {
      setStatus("El pago fue rechazado. Inténtalo con otro método.");
      return;
    }
    if (!response.ok) {
      setStatus("No se pudo completar la reserva.");
      return;
    }
    setResult((await response.json()) as CheckoutResult);
    setStatus(null);
  }

  return (
    <main>
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
        <CalendarDays size={20} aria-hidden />
        Reserva tu cita
      </h1>

      <form onSubmit={(event) => void loadAvailability(event)}>
        <label>
          Servicio (id){" "}
          <input
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            required
          />
        </label>{" "}
        <label>
          Fecha{" "}
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>{" "}
        {config?.providerSelection === "required" && (
          <label>
            Profesional{" "}
            <select value={providerId} onChange={(event) => setProviderId(event.target.value)}>
              <option value="">Elige…</option>
              {config.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.displayName}
                </option>
              ))}
            </select>
          </label>
        )}{" "}
        <button type="submit">Ver huecos</button>
      </form>

      {slots !== null && slots.length > 0 && (
        <ul>
          {slots.map((slot) => (
            <li key={slot.startAt}>
              <button
                type="button"
                aria-pressed={selectedSlot?.startAt === slot.startAt}
                onClick={() => setSelectedSlot(slot)}
              >
                {new Date(slot.startAt).toLocaleString()}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedSlot !== null && result === null && (
        <form onSubmit={(event) => void pay(event)}>
          <h2>Tus datos</h2>
          <label>
            Nombre{" "}
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </label>{" "}
          <label>
            Apellidos{" "}
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </label>{" "}
          <label>
            Email{" "}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>{" "}
          <button type="submit">Reservar y pagar</button>
        </form>
      )}

      {status !== null && <p role="status">{status}</p>}
      {result !== null && (
        <p role="status">
          Reserva <strong>{result.bookingId}</strong> creada en estado{" "}
          <strong>{result.status}</strong>. Recibirás confirmación al completarse el pago.
        </p>
      )}
    </main>
  );
}
