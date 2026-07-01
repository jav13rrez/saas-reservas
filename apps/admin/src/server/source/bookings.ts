/**
 * Booking data source (ADR-0018 Phase 3): demo store or persistent API, chosen
 * by ADMIN_DATA_MODE. Same signatures the route handlers use against the demo
 * store, so handlers only swap their import.
 *
 * Admin bookings are no-charge "book on behalf" (decided). Impedance owned here:
 * the persistent booking carries ids and the API's raw status; the console DTO
 * carries resolved names and the same 6-state `BookingStatus` (feature 004 —
 * pending/approved/rejected/canceled/completed/no_show), unmapped/uncollapsed
 * so the UI can render lifecycle actions and badges for every state.
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
  type BookingStatus,
  type CreateBookingInput,
  type StoreResult,
} from "../demo-store";
import { getSettings } from "./settings";
import { apiGet, apiSend } from "../api-client";

interface ApiBooking {
  id: string;
  serviceId: string;
  providerId: string;
  customerId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
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
    status: booking.status,
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
    const settings = await getSettings();
    return demoCreateBooking(input, settings.policies.requiresApproval);
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
  const result = await apiSend<ApiBooking>("POST", `/v1/admin/bookings/${id}/cancel`, {});
  if (!result.ok || result.data === undefined) {
    return { ok: false, error: result.error ?? "No se pudo cancelar la reserva." };
  }
  return { ok: true, value: toAdmin(result.data, await loadLookups()) };
}

/**
 * Lifecycle transitions (feature 004, US1). In `demo` mode they mutate the
 * store, validating against the domain `TRANSITIONS` (via `canTransition`);
 * an invalid transition throws `InvalidBookingTransitionError`, mirrored here
 * as a rejected `StoreResult` so callers don't need to catch. In `api` mode
 * they call the admin lifecycle routes, which answer 409 on an invalid
 * transition.
 */
async function transition(
  id: string,
  action: "approve" | "reject" | "complete" | "no-show",
  demoFn: (id: string) => StoreResult<AdminBooking>,
): Promise<StoreResult<AdminBooking>> {
  if (dataMode() === "demo") {
    try {
      return demoFn(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transición no válida.";
      return { ok: false, error: message };
    }
  }
  const result = await apiSend<ApiBooking>("POST", `/v1/admin/bookings/${id}/${action}`, {});
  if (!result.ok || result.data === undefined) {
    return { ok: false, error: transitionError(result.error) };
  }
  return { ok: true, value: toAdmin(result.data, await loadLookups()) };
}

export async function approveBooking(id: string): Promise<StoreResult<AdminBooking>> {
  return transition(id, "approve", demoApproveBooking);
}

export async function rejectBooking(id: string): Promise<StoreResult<AdminBooking>> {
  return transition(id, "reject", demoRejectBooking);
}

export async function completeBooking(id: string): Promise<StoreResult<AdminBooking>> {
  return transition(id, "complete", demoCompleteBooking);
}

export async function noShowBooking(id: string): Promise<StoreResult<AdminBooking>> {
  return transition(id, "no-show", demoNoShowBooking);
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

function transitionError(reason: string | undefined): string {
  if (reason === "invalid-transition") {
    return "Esa transición de estado no es válida desde el estado actual.";
  }
  return reason ?? "No se pudo actualizar el estado de la reserva.";
}
