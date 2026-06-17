/**
 * Catalog entities: Category, Service, Extra, Resource and their associations (T021).
 *
 * Duration rule (spec US2 scenario 1, also drives US1 availability):
 *   total = service duration + selected extras' durations + buffer before + buffer after
 * Extras may multiply price by attendees, but never duration.
 */

export type CatalogStatus = "active" | "inactive";

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  status: CatalogStatus;
}

export interface Service {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  durationMinutes: number;
  priceAmount: number;
  currency: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minCapacity: number;
  maxCapacity: number;
  status: CatalogStatus;
}

export interface Extra {
  id: string;
  tenantId: string;
  serviceId: string;
  name: string;
  durationMinutes: number;
  priceAmount: number;
  multiplyByPeople: boolean;
  status: CatalogStatus;
}

export interface Resource {
  id: string;
  tenantId: string;
  name: string;
  /** Number of identical units; allocation is backend-only, never customer-facing. */
  quantity: number;
  /** Site this resource belongs to (multi-site). Optional for single-site tenants. */
  locationId?: string;
  status: CatalogStatus;
}

/** Assignment of a provider to a service. */
export interface ServiceProvider {
  tenantId: string;
  serviceId: string;
  providerId: string;
  status: CatalogStatus;
}

export class InvalidCatalogEntityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCatalogEntityError";
  }
}

export function validateService(service: Service): void {
  if (!Number.isInteger(service.durationMinutes) || service.durationMinutes <= 0) {
    throw new InvalidCatalogEntityError("service duration must be a positive integer of minutes");
  }
  if (service.bufferBeforeMinutes < 0 || service.bufferAfterMinutes < 0) {
    throw new InvalidCatalogEntityError("service buffers cannot be negative");
  }
  if (!Number.isInteger(service.minCapacity) || service.minCapacity < 1) {
    throw new InvalidCatalogEntityError("service min capacity must be at least 1");
  }
  if (service.maxCapacity < service.minCapacity) {
    throw new InvalidCatalogEntityError("service max capacity must be >= min capacity");
  }
  if (service.priceAmount < 0) {
    throw new InvalidCatalogEntityError("service price cannot be negative");
  }
}

export function validateResource(resource: Resource): void {
  if (!Number.isInteger(resource.quantity) || resource.quantity <= 0) {
    throw new InvalidCatalogEntityError("resource quantity must be a positive integer");
  }
}

/** Total slot occupancy in minutes: service + extras + both buffers. */
export function totalDurationMinutes(service: Service, selectedExtras: Extra[]): number {
  const extrasMinutes = selectedExtras.reduce((sum, extra) => sum + extra.durationMinutes, 0);
  return (
    service.bufferBeforeMinutes +
    service.durationMinutes +
    extrasMinutes +
    service.bufferAfterMinutes
  );
}

/** Customer-facing appointment length: service + extras, excluding buffers. */
export function appointmentDurationMinutes(service: Service, selectedExtras: Extra[]): number {
  const extrasMinutes = selectedExtras.reduce((sum, extra) => sum + extra.durationMinutes, 0);
  return service.durationMinutes + extrasMinutes;
}

export function assertAttendeesWithinCapacity(service: Service, attendees: number): void {
  if (
    !Number.isInteger(attendees) ||
    attendees < service.minCapacity ||
    attendees > service.maxCapacity
  ) {
    throw new InvalidCatalogEntityError(
      `attendees must be between ${String(service.minCapacity)} and ${String(service.maxCapacity)}`,
    );
  }
}
