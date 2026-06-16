/**
 * In-memory data store for the admin console's Servicios, Reservas, Recursos and
 * Ubicaciones screens.
 *
 * This mirrors the operations dashboard's approach: the canonical domain logic
 * lives in packages/domain and services/api, but those require the Fastify
 * server with Host-header tenant resolution. To keep the admin runnable with a
 * single `pnpm dev`, these screens talk to Next.js route handlers backed by
 * this process-local store. State persists for the life of the dev server and
 * is stashed on globalThis so it survives hot-module reloads.
 *
 * It implements the resource model end to end so the "4 therapists / 2 rooms"
 * constraint is observable: a service may demand units of a resource (a pool
 * with a quantity at a location), and a booking is rejected when it would
 * exceed the resource's concurrent capacity. Mirrors model B/C from
 * docs/analysis/resources-model-review.md.
 *
 * Money is stored in minor units (cents). Times are ISO-8601 strings.
 */

import { randomUUID } from "node:crypto";

export type StoreResult<T> = { ok: true; value: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface AdminLocation {
  id: string;
  name: string;
  timezone?: string;
  address?: string;
  active: boolean;
}

export interface AdminResource {
  id: string;
  name: string;
  quantity: number;
  locationId?: string;
  active: boolean;
}

export interface AdminService {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  bufferAfterMinutes: number;
  priceAmount: number;
  currency: string;
  /** Optional resource demand: each booking consumes `resourceUnits` of it. */
  resourceId?: string;
  resourceUnits?: number;
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
  locations: AdminLocation[];
  resources: AdminResource[];
  services: AdminService[];
  bookings: AdminBooking[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoAt(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function seed(): DemoData {
  const sedeCentro: AdminLocation = {
    id: randomUUID(),
    name: "Sede Centro",
    timezone: "Europe/Madrid",
    address: "Calle Mayor 1",
    active: true,
  };
  const sedeNorte: AdminLocation = {
    id: randomUUID(),
    name: "Sede Norte",
    timezone: "Europe/Madrid",
    active: true,
  };
  const locations: AdminLocation[] = [sedeCentro, sedeNorte];

  // Two therapy rooms at Sede Centro: the bottleneck in the classic example.
  const salaTerapia: AdminResource = {
    id: randomUUID(),
    name: "Sala de terapia",
    quantity: 2,
    locationId: sedeCentro.id,
    active: true,
  };
  const resources: AdminResource[] = [
    salaTerapia,
    {
      id: randomUUID(),
      name: "Box de tratamiento",
      quantity: 1,
      locationId: sedeNorte.id,
      active: true,
    },
  ];

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
      name: "Sesión de terapia",
      category: "Terapia",
      durationMinutes: 45,
      bufferAfterMinutes: 10,
      priceAmount: 6000,
      currency: "EUR",
      resourceId: salaTerapia.id,
      resourceUnits: 1,
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

  const [consulta, terapia] = services;
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
  if (terapia !== undefined) {
    const startAt = isoAt(2, 16, 30);
    bookings.push({
      id: randomUUID(),
      serviceId: terapia.id,
      serviceName: terapia.name,
      customerName: "Marcos Gil",
      customerEmail: "marcos@example.com",
      startAt,
      endAt: addMinutes(startAt, terapia.durationMinutes),
      status: "confirmed",
      priceAmount: terapia.priceAmount,
      currency: terapia.currency,
      createdAt: isoAt(-2, 14),
    });
  }

  return { locations, resources, services, bookings };
}

const globalForStore = globalThis as typeof globalThis & {
  __saasDemoStore?: DemoData;
};

function data(): DemoData {
  globalForStore.__saasDemoStore ??= seed();
  return globalForStore.__saasDemoStore;
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export function listLocations(): AdminLocation[] {
  return [...data().locations];
}

export function findLocation(id: string): AdminLocation | undefined {
  return data().locations.find((l) => l.id === id);
}

export interface CreateLocationInput {
  name: string;
  timezone: string;
  address: string;
}

export function createLocation(input: CreateLocationInput): StoreResult<AdminLocation> {
  const name = input.name.trim();
  if (name === "") {
    return { ok: false, error: "El nombre de la ubicación es obligatorio." };
  }
  const timezone = input.timezone.trim();
  if (timezone !== "") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      return { ok: false, error: "Zona horaria IANA no válida." };
    }
  }
  const address = input.address.trim();
  const location: AdminLocation = {
    id: randomUUID(),
    name,
    active: true,
    ...(timezone !== "" ? { timezone } : {}),
    ...(address !== "" ? { address } : {}),
  };
  data().locations.unshift(location);
  return { ok: true, value: location };
}

export function setLocationActive(id: string, active: boolean): StoreResult<AdminLocation> {
  const location = findLocation(id);
  if (location === undefined) {
    return { ok: false, error: "Ubicación no encontrada." };
  }
  location.active = active;
  return { ok: true, value: location };
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export function listResources(): AdminResource[] {
  return [...data().resources];
}

export function findResource(id: string): AdminResource | undefined {
  return data().resources.find((r) => r.id === id);
}

export interface CreateResourceInput {
  name: string;
  quantity: number;
  locationId: string;
}

export function createResource(input: CreateResourceInput): StoreResult<AdminResource> {
  const name = input.name.trim();
  if (name === "") {
    return { ok: false, error: "El nombre del recurso es obligatorio." };
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return { ok: false, error: "La cantidad debe ser un entero de al menos 1." };
  }
  const locationId = input.locationId.trim();
  if (locationId !== "" && findLocation(locationId) === undefined) {
    return { ok: false, error: "La ubicación seleccionada no existe." };
  }
  const resource: AdminResource = {
    id: randomUUID(),
    name,
    quantity: input.quantity,
    active: true,
    ...(locationId !== "" ? { locationId } : {}),
  };
  data().resources.unshift(resource);
  return { ok: true, value: resource };
}

export function setResourceActive(id: string, active: boolean): StoreResult<AdminResource> {
  const resource = findResource(id);
  if (resource === undefined) {
    return { ok: false, error: "Recurso no encontrado." };
  }
  resource.active = active;
  return { ok: true, value: resource };
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
  resourceId: string;
  resourceUnits: number;
}

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
  const resourceId = input.resourceId.trim();
  let demand: { resourceId: string; resourceUnits: number } | undefined;
  if (resourceId !== "") {
    const resource = findResource(resourceId);
    if (resource === undefined) {
      return { ok: false, error: "El recurso seleccionado no existe." };
    }
    const units = Number.isFinite(input.resourceUnits) ? Math.round(input.resourceUnits) : 1;
    if (units < 1) {
      return { ok: false, error: "Las unidades de recurso deben ser al menos 1." };
    }
    if (units > resource.quantity) {
      return {
        ok: false,
        error: `El servicio pide ${String(units)} unidades pero el recurso solo tiene ${String(resource.quantity)}.`,
      };
    }
    demand = { resourceId, resourceUnits: units };
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
    ...(demand ?? {}),
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
// Bookings (with resource-capacity enforcement)
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

/**
 * Units of `resourceId` already committed by confirmed bookings overlapping
 * [start, end). Sums across every service that demands the same resource — the
 * resource is the shared bottleneck regardless of service or provider.
 */
function unitsInUse(resourceId: string, start: string, end: string): number {
  let used = 0;
  for (const booking of data().bookings) {
    if (booking.status !== "confirmed") {
      continue;
    }
    const service = findService(booking.serviceId);
    if (service?.resourceId !== resourceId || service.resourceUnits === undefined) {
      continue;
    }
    if (intervalsOverlap(start, end, booking.startAt, booking.endAt)) {
      used += service.resourceUnits;
    }
  }
  return used;
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
  const endAt = addMinutes(startAt, service.durationMinutes);

  // Resource-capacity check (the "4 therapists / 2 rooms" constraint).
  if (service.resourceId !== undefined && service.resourceUnits !== undefined) {
    const resource = findResource(service.resourceId);
    if (resource === undefined) {
      return { ok: false, error: "El recurso del servicio ya no existe." };
    }
    if (!resource.active) {
      return { ok: false, error: `El recurso "${resource.name}" está inactivo.` };
    }
    const used = unitsInUse(resource.id, startAt, endAt);
    if (used + service.resourceUnits > resource.quantity) {
      return {
        ok: false,
        error: `Sin capacidad de "${resource.name}" en ese horario (${String(used)}/${String(resource.quantity)} en uso).`,
      };
    }
  }

  const booking: AdminBooking = {
    id: randomUUID(),
    serviceId: service.id,
    serviceName: service.name,
    customerName,
    customerEmail,
    startAt,
    endAt,
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
