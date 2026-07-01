/**
 * Booking data source (ADR-0018 Phase 3): demo store or persistent API, chosen
 * by ADMIN_DATA_MODE. Same signatures the route handlers use against the demo
 * store, so handlers only swap their import.
 *
 * Admin bookings are no-charge "book on behalf" (decided). Impedance owned here:
 * the persistent booking carries ids and a richer status set, while the console
 * DTO carries resolved names alongside the domain status. This module
 * enriches ids to names from the admin list endpoints and maps the status.
 *
 * Note: the API validates the slot against the availability engine (no double
 * booking / off-schedule), so in `api` mode an arbitrary `startAt` may be
 * rejected with "slot-not-available" — unlike the demo store which accepts any
 * time. The booking date is derived from the UTC date of `startAt`.
 */

import { dataMode } from "../config";
import {
  approveBooking as demoApproveBooking,
  cancelBooking as demoCancelBooking,
  completeBooking as demoCompleteBooking,
  createBooking as demoCreateBooking,
  listBookings as demoListBookings,
  noShowBooking as demoNoShowBooking,
  rejectBooking as demoRejectBooking,
  type AdminBooking,
  type CreateBookingInput,
  type StoreResult,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

interface ApiBooking {
  id: string;
  serviceId: string;
  providerId: string;
  customerId: string;
  startAt: string;
  endAt: string;
  status: string;
  totalAmount: number;
  currency: string;
}

interface NamedEntity {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
}

interface Lookups {
  serviceName: Map<string, string>;
  providerName: Map<string, string>;
  customer: Map<string, { name: string; email: string }>;
}

async function list<T>(path: string): Promise<T[]> {
  const result = await apiGet<{ items: T[] }>(path);
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? `No se pudo cargar ${path}.`);
  }
  return result.data.items;
}

async function loadLookups(): Promise<Lookups> {
  const [services, providers, customers] = await Promise.all([
    list<NamedEntity>("/v1/admin/services"),
    list<NamedEntity>("/v1/admin/providers"),
    list<NamedEntity & { firstName?: string; lastName?: string }>("/v1/admin/customers"),
  ]);
  return {
    serviceName: new Map(services.map((s) => [s.id, s.name ?? ""])),
    providerName: new Map(providers.map((p) => [p.id, p.displayName ?? ""])),
    customer: new Map(customers.map((c) => [c.id, { name: c.name ?? "", email: c.email ?? "" }])),
  };
}

function toAdmin(booking: ApiBooking, lookups: Lookups): AdminBooking {
  const customer = lookups.customer.get(booking.customerId);
  return {
    id: booking.id,
    serviceId: booking.serviceId,
    serviceName: lookups.serviceName.get(booking.serviceId) ?? "—",
    providerId: booking.providerId,
    providerName: lookups.providerName.get(booking.providerId) ?? "—",
    customerId: booking.customerId,
    customerName: customer?.name ?? "—",
    customerEmail: customer?.email ?? "",
    startAt: booking.startAt,
    endAt: booking.endAt,
    status: booking.status as AdminBooking["status"],
    priceAmount: booking.totalAmount,
    currency: booking.currency,
    createdAt: "",
  };
}

/** Calendar date (YYYY-MM-DD) the availability query needs, from a UTC instant. */
function dateOf(startAt: string): string {
  return new Date(startAt).toISOString().slice(0, 10);
}

export async function listBookings(): Promise<AdminBooking[]> {
  if (dataMode() === "demo") {
    return demoListBookings();
  }
  const [bookings, lookups] = await Promise.all([
    list<ApiBooking>("/v1/admin/bookings"),
    loadLookups(),
  ]);
  return bookings
    .map((booking) => toAdmin(booking, lookups))
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
}

export async function createBooking(input: CreateBookingInput): Promise<StoreResult<AdminBooking>> {
  if (dataMode() === "demo") {
    return demoCreateBooking(input);
  }
  const result = await apiSend<ApiBooking>("POST", "/v1/admin/bookings", {
    serviceId: input.serviceId,
    providerId: input.providerId,
    customerId: input.customerId,
    startAt: input.startAt,
    date: dateOf(input.startAt),
  });
  if (!result.ok || result.data === undefined) {
    return { ok: false, error: bookingError(result.error) };
  }
  return { ok: true, value: toAdmin(result.data, await loadLookups()) };
}

export async function cancelBooking(id: string): Promise<StoreResult<AdminBooking>> {
  if (dataMode() === "demo") {
    return demoCancelBooking(id);
  }
  return runLifecycleAction(id, "cancel", "No se pudo cancelar la reserva.");
}

export async function approveBooking(id: string): Promise<StoreResult<AdminBooking>> {
  if (dataMode() === "demo") {
    return demoApproveBooking(id);
  }
  return runLifecycleAction(id, "approve", "No se pudo aprobar la reserva.");
}

export async function rejectBooking(id: string): Promise<StoreResult<AdminBooking>> {
  if (dataMode() === "demo") {
    return demoRejectBooking(id);
  }
  return runLifecycleAction(id, "reject", "No se pudo rechazar la reserva.");
}

export async function completeBooking(id: string): Promise<StoreResult<AdminBooking>> {
  if (dataMode() === "demo") {
    return demoCompleteBooking(id);
  }
  return runLifecycleAction(id, "complete", "No se pudo marcar la reserva como completada.");
}

export async function noShowBooking(id: string): Promise<StoreResult<AdminBooking>> {
  if (dataMode() === "demo") {
    return demoNoShowBooking(id);
  }
  return runLifecycleAction(id, "no-show", "No se pudo marcar la reserva como no-show.");
}

async function runLifecycleAction(
  id: string,
  action: "cancel" | "approve" | "reject" | "complete" | "no-show",
  fallbackError: string,
): Promise<StoreResult<AdminBooking>> {
  const result = await apiSend<ApiBooking>("POST", `/v1/admin/bookings/${id}/${action}`, {});
  if (!result.ok || result.data === undefined) {
    return { ok: false, error: lifecycleError(result.error) ?? fallbackError };
  }
  return { ok: true, value: toAdmin(result.data, await loadLookups()) };
}

const BOOKING_ERRORS: Record<string, string> = {
  "slot-not-available": "Ese horario no está disponible (fuera de agenda o ya ocupado).",
  "provider-required": "Selecciona un proveedor para el servicio.",
  "service-not-found": "El servicio seleccionado no existe.",
};

function bookingError(reason: string | undefined): string {
  if (reason === undefined) {
    return "No se pudo crear la reserva.";
  }
  return BOOKING_ERRORS[reason] ?? reason;
}

function lifecycleError(reason: string | undefined): string | undefined {
  if (reason === "invalid-transition") {
    return "La reserva no admite esa transición desde su estado actual.";
  }
  return reason;
}
