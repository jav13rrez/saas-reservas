/**
 * In-memory data store for the admin console's Servicios and Reservas screens.
 *
 * This mirrors the operations dashboard's approach: the canonical domain logic
 * lives in packages/domain and services/api, but those require the Fastify
 * server with Host-header tenant resolution. To keep the admin runnable with a
 * single `pnpm dev`, these screens talk to Next.js route handlers backed by
 * this process-local store. State persists for the life of the dev server and
 * is stashed on globalThis so it survives hot-module reloads.
 *
 * Money is stored in minor units (cents). Times are ISO-8601 strings.
 */

import { randomUUID } from "node:crypto";

export interface AdminService {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  bufferAfterMinutes: number;
  priceAmount: number;
  currency: string;
  active: boolean;
}

export type BookingStatus = "confirmed" | "cancelled";

export interface AdminBooking {
  id: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  priceAmount: number;
  currency: string;
  createdAt: string;
}

interface DemoData {
  services: AdminService[];
  bookings: AdminBooking[];
}

function isoAt(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function seed(): DemoData {
  const services: AdminService[] = [
    {
      id: randomUUID(),
      name: "Consulta inicial",
      category: "General",
      durationMinutes: 30,
      bufferAfterMinutes: 0,
      priceAmount: 4000,
      currency: "EUR",
      active: true,
    },
    {
      id: randomUUID(),
      name: "Sesión de seguimiento",
      category: "General",
      durationMinutes: 45,
      bufferAfterMinutes: 10,
      priceAmount: 6000,
      currency: "EUR",
      active: true,
    },
    {
      id: randomUUID(),
      name: "Asesoría premium",
      category: "Premium",
      durationMinutes: 60,
      bufferAfterMinutes: 15,
      priceAmount: 12000,
      currency: "EUR",
      active: false,
    },
  ];

  const [consulta, seguimiento] = services;
  const bookings: AdminBooking[] = [];

  if (consulta !== undefined) {
    const startAt = isoAt(1, 10);
    bookings.push({
      id: randomUUID(),
      serviceId: consulta.id,
      serviceName: consulta.name,
      customerName: "Lucía Romero",
      customerEmail: "lucia@example.com",
      startAt,
      endAt: addMinutes(startAt, consulta.durationMinutes),
      status: "confirmed",
      priceAmount: consulta.priceAmount,
      currency: consulta.currency,
      createdAt: isoAt(-1, 9),
    });
  }
  if (seguimiento !== undefined) {
    const startAt = isoAt(2, 16, 30);
    bookings.push({
      id: randomUUID(),
      serviceId: seguimiento.id,
      serviceName: seguimiento.name,
      customerName: "Marcos Gil",
      customerEmail: "marcos@example.com",
      startAt,
      endAt: addMinutes(startAt, seguimiento.durationMinutes),
      status: "confirmed",
      priceAmount: seguimiento.priceAmount,
      currency: seguimiento.currency,
      createdAt: isoAt(-2, 14),
    });
  }
  if (consulta !== undefined) {
    const startAt = isoAt(-3, 11);
    bookings.push({
      id: randomUUID(),
      serviceId: consulta.id,
      serviceName: consulta.name,
      customerName: "Sofía Navarro",
      customerEmail: "sofia@example.com",
      startAt,
      endAt: addMinutes(startAt, consulta.durationMinutes),
      status: "cancelled",
      priceAmount: consulta.priceAmount,
      currency: consulta.currency,
      createdAt: isoAt(-5, 10),
    });
  }

  return { services, bookings };
}

const globalForStore = globalThis as typeof globalThis & {
  __saasDemoStore?: DemoData;
};

function data(): DemoData {
  globalForStore.__saasDemoStore ??= seed();
  return globalForStore.__saasDemoStore;
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export function listServices(): AdminService[] {
  return [...data().services];
}

export function findService(id: string): AdminService | undefined {
  return data().services.find((s) => s.id === id);
}

export interface CreateServiceInput {
  name: string;
  category: string;
  durationMinutes: number;
  bufferAfterMinutes: number;
  priceAmount: number;
  currency: string;
}

export type StoreResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function createService(input: CreateServiceInput): StoreResult<AdminService> {
  const name = input.name.trim();
  if (name === "") {
    return { ok: false, error: "El nombre del servicio es obligatorio." };
  }
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 5) {
    return { ok: false, error: "La duración debe ser de al menos 5 minutos." };
  }
  if (!Number.isFinite(input.priceAmount) || input.priceAmount < 0) {
    return { ok: false, error: "El precio no puede ser negativo." };
  }
  const service: AdminService = {
    id: randomUUID(),
    name,
    category: input.category.trim() === "" ? "General" : input.category.trim(),
    durationMinutes: Math.round(input.durationMinutes),
    bufferAfterMinutes: Math.max(0, Math.round(input.bufferAfterMinutes)),
    priceAmount: Math.round(input.priceAmount),
    currency: input.currency.trim() === "" ? "EUR" : input.currency.trim().toUpperCase(),
    active: true,
  };
  data().services.unshift(service);
  return { ok: true, value: service };
}

export function setServiceActive(id: string, active: boolean): StoreResult<AdminService> {
  const service = findService(id);
  if (service === undefined) {
    return { ok: false, error: "Servicio no encontrado." };
  }
  service.active = active;
  return { ok: true, value: service };
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export function listBookings(): AdminBooking[] {
  return [...data().bookings].sort((a, b) => b.startAt.localeCompare(a.startAt));
}

export interface CreateBookingInput {
  serviceId: string;
  customerName: string;
  customerEmail: string;
  startAt: string;
}

export function createBooking(input: CreateBookingInput): StoreResult<AdminBooking> {
  const service = findService(input.serviceId);
  if (service === undefined) {
    return { ok: false, error: "El servicio seleccionado no existe." };
  }
  if (!service.active) {
    return { ok: false, error: "No se puede reservar un servicio inactivo." };
  }
  const customerName = input.customerName.trim();
  const customerEmail = input.customerEmail.trim();
  if (customerName === "" || customerEmail === "") {
    return { ok: false, error: "Nombre y email del cliente son obligatorios." };
  }
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "La fecha y hora de inicio no son válidas." };
  }
  const startAt = start.toISOString();
  const booking: AdminBooking = {
    id: randomUUID(),
    serviceId: service.id,
    serviceName: service.name,
    customerName,
    customerEmail,
    startAt,
    endAt: addMinutes(startAt, service.durationMinutes),
    status: "confirmed",
    priceAmount: service.priceAmount,
    currency: service.currency,
    createdAt: new Date().toISOString(),
  };
  data().bookings.push(booking);
  return { ok: true, value: booking };
}

export function cancelBooking(id: string): StoreResult<AdminBooking> {
  const booking = data().bookings.find((b) => b.id === id);
  if (booking === undefined) {
    return { ok: false, error: "Reserva no encontrada." };
  }
  if (booking.status === "cancelled") {
    return { ok: false, error: "La reserva ya está cancelada." };
  }
  booking.status = "cancelled";
  return { ok: true, value: booking };
}
