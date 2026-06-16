/**
 * In-memory data store for the admin console's connected screens: Ubicaciones,
 * Recursos, Servicios, Proveedores, Clientes, Reservas and Calendario.
 *
 * This mirrors the operations dashboard's approach: the canonical domain logic
 * lives in packages/domain and services/api, but those require the Fastify
 * server with Host-header tenant resolution. To keep the admin runnable with a
 * single `pnpm dev`, these screens talk to Next.js route handlers backed by
 * this process-local store. State persists for the life of the dev server and
 * is stashed on globalThis so it survives hot-module reloads.
 *
 * It implements the full assignment chain end to end so the business logic is
 * observable:
 *
 *   Ubicación -> Recurso -> Proveedor -> Servicio -> Reserva -> Cliente
 *
 * Resource hub model (partial Amelia alignment):
 * - A resource declares which locations it lives at (locationIds[]).
 * - A resource declares which services trigger its allocation (serviceIds[]).
 * - A resource declares which providers are eligible to use it (employeeIds[],
 *   empty = any provider).
 * - A service no longer points to a resource; the resource declares the service.
 * - A provider no longer declares eligible resources; the resource declares it.
 * - Capacity (quantity) is simple: each booking consumes 1 unit of every
 *   resource that applies to its service.
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
  /** Locations where this resource is physically available. Empty = any location. */
  locationIds: string[];
  /** Services whose bookings consume one unit of this resource. Empty = no services. */
  serviceIds: string[];
  /** Providers eligible to use this resource. Empty = any provider. */
  employeeIds: string[];
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
  active: boolean;
}

export interface AdminProvider {
  id: string;
  name: string;
  email: string;
  timezone?: string;
  /** Locations the provider works at. Empty = any location. */
  locationIds: string[];
  /** Services the provider can deliver. */
  serviceIds: string[];
  active: boolean;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  active: boolean;
  createdAt: string;
}

export type BookingStatus = "confirmed" | "cancelled";

export interface AdminBooking {
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
  createdAt: string;
}

interface DemoData {
  locations: AdminLocation[];
  resources: AdminResource[];
  services: AdminService[];
  providers: AdminProvider[];
  customers: AdminCustomer[];
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

/** Validate an IANA timezone string; "" is treated as unset (valid). */
function timezoneIsValid(tz: string): boolean {
  if (tz === "") {
    return true;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Filter a candidate id list down to ids that exist in `valid`. */
function keepKnown(ids: unknown, valid: Set<string>): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id === "string" && valid.has(id)) {
      seen.add(id);
    }
  }
  return [...seen];
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

  const consulta: AdminService = {
    id: randomUUID(),
    name: "Consulta inicial",
    category: "General",
    durationMinutes: 30,
    bufferAfterMinutes: 0,
    priceAmount: 4000,
    currency: "EUR",
    active: true,
  };
  const terapia: AdminService = {
    id: randomUUID(),
    name: "Sesión de terapia",
    category: "Terapia",
    durationMinutes: 45,
    bufferAfterMinutes: 10,
    priceAmount: 6000,
    currency: "EUR",
    active: true,
  };
  const premium: AdminService = {
    id: randomUUID(),
    name: "Asesoría premium",
    category: "Premium",
    durationMinutes: 60,
    bufferAfterMinutes: 15,
    priceAmount: 12000,
    currency: "EUR",
    active: false,
  };
  const services: AdminService[] = [consulta, terapia, premium];

  // Ana works at Sede Centro and delivers both services.
  const ana: AdminProvider = {
    id: randomUUID(),
    name: "Ana Torres",
    email: "ana@example.com",
    timezone: "Europe/Madrid",
    locationIds: [sedeCentro.id],
    serviceIds: [consulta.id, terapia.id],
    active: true,
  };
  // Carlos delivers the initial consult at both locations (no resource constraint).
  const carlos: AdminProvider = {
    id: randomUUID(),
    name: "Carlos Ruiz",
    email: "carlos@example.com",
    timezone: "Europe/Madrid",
    locationIds: [sedeCentro.id, sedeNorte.id],
    serviceIds: [consulta.id],
    active: true,
  };
  const providers: AdminProvider[] = [ana, carlos];

  // Two therapy rooms at Sede Centro: the capacity bottleneck.
  // Hub model: the resource declares which services and which providers it applies to.
  const salaTerapia: AdminResource = {
    id: randomUUID(),
    name: "Sala de terapia",
    quantity: 2,
    locationIds: [sedeCentro.id],
    serviceIds: [terapia.id],
    employeeIds: [ana.id], // only Ana is eligible for the therapy room
    active: true,
  };
  const boxNorte: AdminResource = {
    id: randomUUID(),
    name: "Box de tratamiento",
    quantity: 1,
    locationIds: [sedeNorte.id],
    serviceIds: [], // no services assigned yet
    employeeIds: [],
    active: true,
  };
  const resources: AdminResource[] = [salaTerapia, boxNorte];

  const lucia: AdminCustomer = {
    id: randomUUID(),
    name: "Lucía Romero",
    email: "lucia@example.com",
    phone: "+34 600 111 222",
    active: true,
    createdAt: isoAt(-10, 9),
  };
  const marcos: AdminCustomer = {
    id: randomUUID(),
    name: "Marcos Gil",
    email: "marcos@example.com",
    active: true,
    createdAt: isoAt(-8, 11),
  };
  const customers: AdminCustomer[] = [lucia, marcos];

  const bookings: AdminBooking[] = [];
  {
    const startAt = isoAt(1, 10);
    bookings.push({
      id: randomUUID(),
      serviceId: consulta.id,
      serviceName: consulta.name,
      providerId: carlos.id,
      providerName: carlos.name,
      customerId: lucia.id,
      customerName: lucia.name,
      customerEmail: lucia.email,
      startAt,
      endAt: addMinutes(startAt, consulta.durationMinutes),
      status: "confirmed",
      priceAmount: consulta.priceAmount,
      currency: consulta.currency,
      createdAt: isoAt(-1, 9),
    });
  }
  {
    const startAt = isoAt(2, 16, 30);
    bookings.push({
      id: randomUUID(),
      serviceId: terapia.id,
      serviceName: terapia.name,
      providerId: ana.id,
      providerName: ana.name,
      customerId: marcos.id,
      customerName: marcos.name,
      customerEmail: marcos.email,
      startAt,
      endAt: addMinutes(startAt, terapia.durationMinutes),
      status: "confirmed",
      priceAmount: terapia.priceAmount,
      currency: terapia.currency,
      createdAt: isoAt(-2, 14),
    });
  }

  return { locations, resources, services, providers, customers, bookings };
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
  if (!timezoneIsValid(timezone)) {
    return { ok: false, error: "Zona horaria IANA no válida." };
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
// Resources (hub model)
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
  locationIds: unknown;
  serviceIds: unknown;
  employeeIds: unknown;
}

export function createResource(input: CreateResourceInput): StoreResult<AdminResource> {
  const name = input.name.trim();
  if (name === "") {
    return { ok: false, error: "El nombre del recurso es obligatorio." };
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return { ok: false, error: "La cantidad debe ser un entero de al menos 1." };
  }
  const validLocations = new Set(data().locations.map((l) => l.id));
  const validServices = new Set(data().services.map((s) => s.id));
  const validProviders = new Set(data().providers.map((p) => p.id));

  const resource: AdminResource = {
    id: randomUUID(),
    name,
    quantity: input.quantity,
    locationIds: keepKnown(input.locationIds, validLocations),
    serviceIds: keepKnown(input.serviceIds, validServices),
    employeeIds: keepKnown(input.employeeIds, validProviders),
    active: true,
  };
  data().resources.unshift(resource);
  return { ok: true, value: resource };
}

export interface UpdateResourceInput {
  name?: string;
  quantity?: number;
  locationIds?: unknown;
  serviceIds?: unknown;
  employeeIds?: unknown;
  active?: boolean;
}

export function updateResource(id: string, input: UpdateResourceInput): StoreResult<AdminResource> {
  const resource = findResource(id);
  if (resource === undefined) {
    return { ok: false, error: "Recurso no encontrado." };
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name === "") {
      return { ok: false, error: "El nombre del recurso es obligatorio." };
    }
    resource.name = name;
  }
  if (input.quantity !== undefined) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      return { ok: false, error: "La cantidad debe ser un entero de al menos 1." };
    }
    resource.quantity = input.quantity;
  }
  if (input.locationIds !== undefined) {
    resource.locationIds = keepKnown(input.locationIds, new Set(data().locations.map((l) => l.id)));
  }
  if (input.serviceIds !== undefined) {
    resource.serviceIds = keepKnown(input.serviceIds, new Set(data().services.map((s) => s.id)));
  }
  if (input.employeeIds !== undefined) {
    resource.employeeIds = keepKnown(
      input.employeeIds,
      new Set(data().providers.map((p) => p.id)),
    );
  }
  if (input.active !== undefined) {
    resource.active = input.active;
  }
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
// Providers
// ---------------------------------------------------------------------------

export function listProviders(): AdminProvider[] {
  return [...data().providers];
}

export function findProvider(id: string): AdminProvider | undefined {
  return data().providers.find((p) => p.id === id);
}

export interface CreateProviderInput {
  name: string;
  email: string;
  timezone: string;
  locationIds: unknown;
  serviceIds: unknown;
}

export function createProvider(input: CreateProviderInput): StoreResult<AdminProvider> {
  const name = input.name.trim();
  if (name === "") {
    return { ok: false, error: "El nombre del proveedor es obligatorio." };
  }
  const email = input.email.trim().toLowerCase();
  if (email === "" || !email.includes("@")) {
    return { ok: false, error: "El email del proveedor no es válido." };
  }
  if (data().providers.some((p) => p.email === email)) {
    return { ok: false, error: "Ya existe un proveedor con ese email." };
  }
  const timezone = input.timezone.trim();
  if (!timezoneIsValid(timezone)) {
    return { ok: false, error: "Zona horaria IANA no válida." };
  }

  const validLocations = new Set(data().locations.map((l) => l.id));
  const validServices = new Set(data().services.map((s) => s.id));

  const provider: AdminProvider = {
    id: randomUUID(),
    name,
    email,
    locationIds: keepKnown(input.locationIds, validLocations),
    serviceIds: keepKnown(input.serviceIds, validServices),
    active: true,
    ...(timezone !== "" ? { timezone } : {}),
  };
  data().providers.unshift(provider);
  return { ok: true, value: provider };
}

export interface UpdateProviderInput {
  name?: string;
  email?: string;
  timezone?: string;
  locationIds?: unknown;
  serviceIds?: unknown;
  active?: boolean;
}

export function updateProvider(id: string, input: UpdateProviderInput): StoreResult<AdminProvider> {
  const provider = findProvider(id);
  if (provider === undefined) {
    return { ok: false, error: "Proveedor no encontrado." };
  }

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name === "") {
      return { ok: false, error: "El nombre del proveedor es obligatorio." };
    }
    provider.name = name;
  }
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (email === "" || !email.includes("@")) {
      return { ok: false, error: "El email del proveedor no es válido." };
    }
    if (data().providers.some((p) => p.id !== id && p.email === email)) {
      return { ok: false, error: "Ya existe un proveedor con ese email." };
    }
    provider.email = email;
  }
  if (input.timezone !== undefined) {
    const timezone = input.timezone.trim();
    if (!timezoneIsValid(timezone)) {
      return { ok: false, error: "Zona horaria IANA no válida." };
    }
    if (timezone === "") {
      delete provider.timezone;
    } else {
      provider.timezone = timezone;
    }
  }
  if (input.locationIds !== undefined) {
    provider.locationIds = keepKnown(input.locationIds, new Set(data().locations.map((l) => l.id)));
  }
  if (input.serviceIds !== undefined) {
    provider.serviceIds = keepKnown(input.serviceIds, new Set(data().services.map((s) => s.id)));
  }
  if (input.active !== undefined) {
    provider.active = input.active;
  }
  return { ok: true, value: provider };
}

/** Providers that can deliver a given service (active only). */
export function providersForService(serviceId: string): AdminProvider[] {
  return data().providers.filter((p) => p.active && p.serviceIds.includes(serviceId));
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export function listCustomers(): AdminCustomer[] {
  return [...data().customers].sort((a, b) => a.name.localeCompare(b.name));
}

export function findCustomer(id: string): AdminCustomer | undefined {
  return data().customers.find((c) => c.id === id);
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone: string;
}

export function createCustomer(input: CreateCustomerInput): StoreResult<AdminCustomer> {
  const name = input.name.trim();
  if (name === "") {
    return { ok: false, error: "El nombre del cliente es obligatorio." };
  }
  const email = input.email.trim().toLowerCase();
  if (email === "" || !email.includes("@")) {
    return { ok: false, error: "El email del cliente no es válido." };
  }
  if (data().customers.some((c) => c.email === email)) {
    return { ok: false, error: "Ya existe un cliente con ese email." };
  }
  const phone = input.phone.trim();
  const customer: AdminCustomer = {
    id: randomUUID(),
    name,
    email,
    active: true,
    createdAt: new Date().toISOString(),
    ...(phone !== "" ? { phone } : {}),
  };
  data().customers.unshift(customer);
  return { ok: true, value: customer };
}

export function setCustomerActive(id: string, active: boolean): StoreResult<AdminCustomer> {
  const customer = findCustomer(id);
  if (customer === undefined) {
    return { ok: false, error: "Cliente no encontrado." };
  }
  customer.active = active;
  return { ok: true, value: customer };
}

// ---------------------------------------------------------------------------
// Bookings (with the full hub-model validation)
// ---------------------------------------------------------------------------

export function listBookings(): AdminBooking[] {
  return [...data().bookings].sort((a, b) => b.startAt.localeCompare(a.startAt));
}

export interface CreateBookingInput {
  serviceId: string;
  providerId: string;
  customerId: string;
  startAt: string;
}

/**
 * Units of `resourceId` already consumed by confirmed bookings that overlap
 * [start, end). Each confirmed booking whose service is in resource.serviceIds
 * consumes 1 unit of that resource.
 */
function unitsInUse(resource: AdminResource, start: string, end: string): number {
  let used = 0;
  for (const booking of data().bookings) {
    if (booking.status !== "confirmed") continue;
    if (!resource.serviceIds.includes(booking.serviceId)) continue;
    if (intervalsOverlap(start, end, booking.startAt, booking.endAt)) {
      used += 1;
    }
  }
  return used;
}

/** True if the provider already has a confirmed booking overlapping [start, end). */
function providerBusy(providerId: string, start: string, end: string): boolean {
  return data().bookings.some(
    (b) =>
      b.status === "confirmed" &&
      b.providerId === providerId &&
      intervalsOverlap(start, end, b.startAt, b.endAt),
  );
}

export function createBooking(input: CreateBookingInput): StoreResult<AdminBooking> {
  const service = findService(input.serviceId);
  if (service === undefined) {
    return { ok: false, error: "El servicio seleccionado no existe." };
  }
  if (!service.active) {
    return { ok: false, error: "No se puede reservar un servicio inactivo." };
  }

  const customer = findCustomer(input.customerId);
  if (customer === undefined) {
    return { ok: false, error: "El cliente seleccionado no existe." };
  }
  if (!customer.active) {
    return { ok: false, error: "El cliente está inactivo." };
  }

  const provider = findProvider(input.providerId);
  if (provider === undefined) {
    return { ok: false, error: "El proveedor seleccionado no existe." };
  }
  if (!provider.active) {
    return { ok: false, error: "El proveedor está inactivo." };
  }
  if (!provider.serviceIds.includes(service.id)) {
    return { ok: false, error: `"${provider.name}" no presta el servicio "${service.name}".` };
  }

  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "La fecha y hora de inicio no son válidas." };
  }
  const startAt = start.toISOString();
  const endAt = addMinutes(startAt, service.durationMinutes);

  // Hub resource chain: find every resource that applies to this service.
  const candidateResources = data().resources.filter(
    (r) => r.active && r.serviceIds.includes(service.id),
  );

  if (candidateResources.length > 0) {
    // Provider eligibility: resource.employeeIds empty = any provider OK.
    const eligibleResources = candidateResources.filter(
      (r) => r.employeeIds.length === 0 || r.employeeIds.includes(provider.id),
    );
    if (eligibleResources.length === 0) {
      return {
        ok: false,
        error: `"${provider.name}" no es elegible para ningún recurso de "${service.name}".`,
      };
    }

    // Location compatibility: overlap between resource locations and provider locations.
    // Empty locationIds on either side means "any location".
    const locationCompatible = eligibleResources.filter(
      (r) =>
        r.locationIds.length === 0 ||
        provider.locationIds.length === 0 ||
        provider.locationIds.some((lid) => r.locationIds.includes(lid)),
    );
    if (locationCompatible.length === 0) {
      return {
        ok: false,
        error: `"${provider.name}" no trabaja en ninguna ubicación donde esté disponible el recurso requerido para "${service.name}".`,
      };
    }

    // Capacity: at least one compatible resource must have a free slot.
    const hasCapacity = locationCompatible.some(
      (r) => unitsInUse(r, startAt, endAt) < r.quantity,
    );
    if (!hasCapacity) {
      const names = locationCompatible.map((r) => r.name).join(", ");
      return {
        ok: false,
        error: `Sin capacidad disponible (${names}) en ese horario.`,
      };
    }
  }

  // The provider cannot be in two places at once.
  if (providerBusy(provider.id, startAt, endAt)) {
    return {
      ok: false,
      error: `"${provider.name}" ya tiene una reserva en ese horario.`,
    };
  }

  const booking: AdminBooking = {
    id: randomUUID(),
    serviceId: service.id,
    serviceName: service.name,
    providerId: provider.id,
    providerName: provider.name,
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
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
