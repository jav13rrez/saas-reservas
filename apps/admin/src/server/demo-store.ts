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
 * - A resource is a pool with a quantity at a location.
 * - A service may demand units of a resource.
 * - A provider works at one or more locations, is eligible for a set of
 *   resources (model B: empty = unconstrained), and delivers a set of services.
 * - A booking links a customer, a service and a provider; it is rejected unless
 *   the provider delivers the service, is eligible for the demanded resource,
 *   works at the resource's location, the resource has spare capacity, and the
 *   provider is not already busy in that interval.
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

export interface AdminProvider {
  id: string;
  name: string;
  email: string;
  timezone?: string;
  /** Locations the provider works at. Empty = any location. */
  locationIds: string[];
  /** Eligible resources (model B). Empty = unconstrained (any resource). */
  resourceIds: string[];
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

  // Two therapy rooms at Sede Centro: the bottleneck in the classic example.
  const salaTerapia: AdminResource = {
    id: randomUUID(),
    name: "Sala de terapia",
    quantity: 2,
    locationId: sedeCentro.id,
    active: true,
  };
  const boxNorte: AdminResource = {
    id: randomUUID(),
    name: "Box de tratamiento",
    quantity: 1,
    locationId: sedeNorte.id,
    active: true,
  };
  const resources: AdminResource[] = [salaTerapia, boxNorte];

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
    resourceId: salaTerapia.id,
    resourceUnits: 1,
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

  // Ana works at Sede Centro, is eligible for the therapy room, and delivers
  // both the initial consult and the therapy session.
  const ana: AdminProvider = {
    id: randomUUID(),
    name: "Ana Torres",
    email: "ana@example.com",
    timezone: "Europe/Madrid",
    locationIds: [sedeCentro.id],
    resourceIds: [salaTerapia.id],
    serviceIds: [consulta.id, terapia.id],
    active: true,
  };
  // Carlos only delivers the initial consult (no resource demand).
  const carlos: AdminProvider = {
    id: randomUUID(),
    name: "Carlos Ruiz",
    email: "carlos@example.com",
    timezone: "Europe/Madrid",
    locationIds: [sedeCentro.id, sedeNorte.id],
    resourceIds: [],
    serviceIds: [consulta.id],
    active: true,
  };
  const providers: AdminProvider[] = [ana, carlos];

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
// Providers (with the location/resource/service assignment chain)
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
  resourceIds: unknown;
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
  const validResources = new Set(data().resources.map((r) => r.id));
  const validServices = new Set(data().services.map((s) => s.id));

  const provider: AdminProvider = {
    id: randomUUID(),
    name,
    email,
    locationIds: keepKnown(input.locationIds, validLocations),
    resourceIds: keepKnown(input.resourceIds, validResources),
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
  resourceIds?: unknown;
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
  if (input.resourceIds !== undefined) {
    provider.resourceIds = keepKnown(input.resourceIds, new Set(data().resources.map((r) => r.id)));
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
// Bookings (with the full assignment-chain validation)
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

  // Resource chain: eligibility (model B), location, and concurrent capacity.
  if (service.resourceId !== undefined && service.resourceUnits !== undefined) {
    const resource = findResource(service.resourceId);
    if (resource === undefined) {
      return { ok: false, error: "El recurso del servicio ya no existe." };
    }
    if (!resource.active) {
      return { ok: false, error: `El recurso "${resource.name}" está inactivo.` };
    }
    // Model B: empty eligibility = unconstrained; otherwise must include it.
    if (provider.resourceIds.length > 0 && !provider.resourceIds.includes(resource.id)) {
      return {
        ok: false,
        error: `"${provider.name}" no es elegible para el recurso "${resource.name}".`,
      };
    }
    // Location chain: a provider with declared sites must work where the
    // resource lives.
    if (
      resource.locationId !== undefined &&
      provider.locationIds.length > 0 &&
      !provider.locationIds.includes(resource.locationId)
    ) {
      const location = findLocation(resource.locationId);
      return {
        ok: false,
        error: `"${provider.name}" no trabaja en la ubicación del recurso${
          location !== undefined ? ` (${location.name})` : ""
        }.`,
      };
    }
    const used = unitsInUse(resource.id, startAt, endAt);
    if (used + service.resourceUnits > resource.quantity) {
      return {
        ok: false,
        error: `Sin capacidad de "${resource.name}" en ese horario (${String(used)}/${String(resource.quantity)} en uso).`,
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
