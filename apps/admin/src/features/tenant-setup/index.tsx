"use client";

/**
 * Minimal tenant setup UI and booking-widget availability preview (T026).
 *
 * Walks the US1 happy path against the API: create service -> create provider
 * -> assign -> set weekly schedule, then previews the public availability the
 * widget would show. Styling and full CRUD arrive with later admin tasks.
 */

import { useState } from "react";
import { Building2 } from "lucide-react";

interface SubmitEvent {
  preventDefault(): void;
}

interface Slot {
  startAt: string;
  endAt: string;
}

interface AvailabilityResponse {
  providerId: string;
  providerSelection: "auto" | "explicit";
  slots: Slot[];
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`${url} failed with ${String(response.status)}`);
  }
  return (await response.json()) as T;
}

export function TenantSetup() {
  const [serviceName, setServiceName] = useState("Consulta");
  const [duration, setDuration] = useState(30);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [providerName, setProviderName] = useState("");
  const [providerEmail, setProviderEmail] = useState("");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [date, setDate] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSetup(event: SubmitEvent) {
    event.preventDefault();
    setStatus("Creando catálogo…");
    try {
      const category = await postJson<{ id: string }>("/api/v1/admin/categories", {
        name: "General",
      });
      const service = await postJson<{ id: string }>("/api/v1/admin/services", {
        categoryId: category.id,
        name: serviceName,
        durationMinutes: duration,
        priceAmount: 0,
        currency: "EUR",
        bufferAfterMinutes: bufferAfter,
      });
      const provider = await postJson<{ id: string }>("/api/v1/admin/providers", {
        email: providerEmail,
        displayName: providerName,
        timezone,
      });
      await postJson(`/api/v1/admin/services/${service.id}/providers`, {
        providerId: provider.id,
      });
      await fetch(`/api/v1/admin/providers/${provider.id}/schedule`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entries: [1, 2, 3, 4, 5].map((weekday) => ({
            kind: "weekly",
            weekday,
            startTime: "09:00",
            endTime: "17:00",
            breaks: [],
          })),
        }),
      });
      setServiceId(service.id);
      setStatus("Servicio publicado. Consulta la disponibilidad.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Error inesperado");
    }
  }

  async function handlePreview(event: SubmitEvent) {
    event.preventDefault();
    if (serviceId === null || date === "") {
      return;
    }
    setStatus("Cargando disponibilidad…");
    const response = await fetch(`/api/v1/public/availability?serviceId=${serviceId}&date=${date}`);
    if (!response.ok) {
      setStatus(`Disponibilidad falló con ${String(response.status)}`);
      return;
    }
    const body = (await response.json()) as AvailabilityResponse;
    setSlots(body.slots);
    setStatus(null);
  }

  return (
    <main>
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
        <Building2 size={20} aria-hidden />
        Configuración del tenant
      </h1>
      <form onSubmit={(event) => void handleSetup(event)}>
        <fieldset>
          <legend>Servicio</legend>
          <label>
            Nombre{" "}
            <input
              value={serviceName}
              onChange={(event) => {
                setServiceName(event.target.value);
              }}
              required
            />
          </label>{" "}
          <label>
            Duración (min){" "}
            <input
              type="number"
              min={5}
              value={duration}
              onChange={(event) => {
                setDuration(Number(event.target.value));
              }}
            />
          </label>{" "}
          <label>
            Buffer después (min){" "}
            <input
              type="number"
              min={0}
              value={bufferAfter}
              onChange={(event) => {
                setBufferAfter(Number(event.target.value));
              }}
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>Provider</legend>
          <label>
            Nombre{" "}
            <input
              value={providerName}
              onChange={(event) => {
                setProviderName(event.target.value);
              }}
              required
            />
          </label>{" "}
          <label>
            Email{" "}
            <input
              type="email"
              value={providerEmail}
              onChange={(event) => {
                setProviderEmail(event.target.value);
              }}
              required
            />
          </label>{" "}
          <label>
            Zona horaria{" "}
            <input
              value={timezone}
              onChange={(event) => {
                setTimezone(event.target.value);
              }}
              required
            />
          </label>
        </fieldset>
        <button type="submit">Publicar servicio reservable</button>
      </form>

      <h2>Vista del widget: disponibilidad</h2>
      <form onSubmit={(event) => void handlePreview(event)}>
        <label>
          Fecha{" "}
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
            }}
            required
          />
        </label>{" "}
        <button type="submit" disabled={serviceId === null}>
          Ver slots
        </button>
      </form>

      {status !== null && <p role="status">{status}</p>}
      {slots !== null && (
        <ul>
          {slots.length === 0 && <li>Sin disponibilidad para esa fecha.</li>}
          {slots.map((slot) => (
            <li key={slot.startAt}>
              {new Date(slot.startAt).toLocaleTimeString()} –{" "}
              {new Date(slot.endAt).toLocaleTimeString()}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
