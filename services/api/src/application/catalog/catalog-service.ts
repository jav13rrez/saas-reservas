/**
 * Catalog application service (T023): categories, services, extras, providers,
 * schedules, and resources, plus the read model the availability engine needs.
 */

import { randomUUID } from "node:crypto";
import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import {
  validateResource,
  validateService,
  type Category,
  type Extra,
  type Resource,
  type Service,
  type ServiceProvider,
} from "@saas-reservas/domain/catalog/service";
import {
  validateScheduleEntry,
  type Provider,
  type ProviderScheduleEntry,
} from "@saas-reservas/domain/providers/provider";
import type { Interval } from "@saas-reservas/domain/scheduling/time";
import type { ResourceAllocation } from "../scheduling/availability-engine.js";
import type { EventSink } from "../events.js";

export interface CatalogRepository {
  insertCategory(category: Category): Promise<void>;
  insertService(service: Service): Promise<void>;
  insertExtra(extra: Extra): Promise<void>;
  insertResource(resource: Resource): Promise<void>;
  insertProvider(provider: Provider): Promise<void>;
  /** Replace a service by id (admin edit / status toggle). */
  updateService(service: Service): Promise<void>;
  /** Replace a provider by id (admin edit / status toggle). */
  updateProvider(provider: Provider): Promise<void>;
  /** Replace a resource by id (admin edit / status toggle). */
  updateResource(resource: Resource): Promise<void>;
  /** Remove a provider's assignment to a service. */
  unassignProvider(tenantId: string, serviceId: string, providerId: string): Promise<void>;
  setProviderSchedule(
    tenantId: string,
    providerId: string,
    entries: ProviderScheduleEntry[],
  ): Promise<void>;
  assignProvider(link: ServiceProvider): Promise<void>;
  /** Replace the sites a provider works at (empty = any location). */
  setProviderLocations(tenantId: string, providerId: string, locationIds: string[]): Promise<void>;
  /** Sites a provider works at; empty means "any location". */
  listProviderLocationIds(tenantId: string, providerId: string): Promise<string[]>;

  findServiceById(tenantId: string, serviceId: string): Promise<Service | null>;
  findProviderById(tenantId: string, providerId: string): Promise<Provider | null>;
  listExtras(tenantId: string, serviceId: string, extraIds: string[]): Promise<Extra[]>;
  listActiveProvidersForService(tenantId: string, serviceId: string): Promise<Provider[]>;

  // Admin read model (console listing surface). Unlike the availability lookups
  // above, these return every entity for the tenant regardless of status so the
  // admin can render and toggle inactive items.
  listCategories(tenantId: string): Promise<Category[]>;
  listServices(tenantId: string): Promise<Service[]>;
  listProviders(tenantId: string): Promise<Provider[]>;
  listResources(tenantId: string): Promise<Resource[]>;
  /** Service ids a provider is assigned to deliver (active assignments). */
  listProviderServiceIds(tenantId: string, providerId: string): Promise<string[]>;
  listScheduleEntries(tenantId: string, providerId: string): Promise<ProviderScheduleEntry[]>;
  listProviderBusy(tenantId: string, providerId: string, range: Interval): Promise<Interval[]>;
  listResourceAllocations(
    tenantId: string,
    resourceId: string,
    range: Interval,
  ): Promise<ResourceAllocation[]>;
}

/** A provider enriched with its service assignments and work locations. */
export interface ProviderWithAssignments {
  provider: Provider;
  serviceIds: string[];
  locationIds: string[];
}

export class CatalogService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly events: EventSink,
  ) {}

  // --- Admin read model ------------------------------------------------------

  listCategories(tenantId: string): Promise<Category[]> {
    return this.catalog.listCategories(tenantId);
  }

  listServices(tenantId: string): Promise<Service[]> {
    return this.catalog.listServices(tenantId);
  }

  listResources(tenantId: string): Promise<Resource[]> {
    return this.catalog.listResources(tenantId);
  }

  /** Providers with their service assignments and work locations resolved. */
  async listProviders(tenantId: string): Promise<ProviderWithAssignments[]> {
    const providers = await this.catalog.listProviders(tenantId);
    return Promise.all(
      providers.map(async (provider) => ({
        provider,
        serviceIds: await this.catalog.listProviderServiceIds(tenantId, provider.id),
        locationIds: await this.catalog.listProviderLocationIds(tenantId, provider.id),
      })),
    );
  }

  async createCategory(
    input: Omit<Category, "id" | "status"> & { actor: Actor },
  ): Promise<Category> {
    const category: Category = { ...input, id: randomUUID(), status: "active" };
    await this.catalog.insertCategory(category);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.category-created",
      "category",
      category.id,
    );
    return category;
  }

  async createService(input: Omit<Service, "id" | "status"> & { actor: Actor }): Promise<Service> {
    const service: Service = { ...input, id: randomUUID(), status: "active" };
    validateService(service);
    await this.catalog.insertService(service);
    await this.audit(input.tenantId, input.actor, "catalog.service-created", "service", service.id);
    return service;
  }

  async createExtra(input: Omit<Extra, "id" | "status"> & { actor: Actor }): Promise<Extra> {
    const extra: Extra = { ...input, id: randomUUID(), status: "active" };
    await this.catalog.insertExtra(extra);
    await this.audit(input.tenantId, input.actor, "catalog.extra-created", "extra", extra.id);
    return extra;
  }

  async createResource(
    input: Omit<Resource, "id" | "status"> & { actor: Actor },
  ): Promise<Resource> {
    const resource: Resource = { ...input, id: randomUUID(), status: "active" };
    validateResource(resource);
    await this.catalog.insertResource(resource);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.resource-created",
      "resource",
      resource.id,
    );
    return resource;
  }

  async createProvider(
    input: Omit<Provider, "id" | "status"> & { actor: Actor },
  ): Promise<Provider> {
    const provider: Provider = { ...input, id: randomUUID(), status: "active" };
    await this.catalog.insertProvider(provider);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.provider-created",
      "provider",
      provider.id,
    );
    return provider;
  }

  /** Apply a partial update to a service (admin edit / active toggle). */
  async updateService(input: {
    tenantId: string;
    serviceId: string;
    patch: Partial<
      Pick<
        Service,
        | "name"
        | "durationMinutes"
        | "priceAmount"
        | "currency"
        | "bufferBeforeMinutes"
        | "bufferAfterMinutes"
        | "minCapacity"
        | "maxCapacity"
        | "status"
      >
    >;
    actor: Actor;
  }): Promise<Service | null> {
    const existing = await this.catalog.findServiceById(input.tenantId, input.serviceId);
    if (existing === null) {
      return null;
    }
    const updated: Service = { ...existing, ...input.patch };
    validateService(updated);
    await this.catalog.updateService(updated);
    await this.audit(input.tenantId, input.actor, "catalog.service-updated", "service", updated.id);
    return updated;
  }

  /** Apply a partial update to a provider (admin edit / active toggle). */
  async updateProvider(input: {
    tenantId: string;
    providerId: string;
    patch: Partial<Pick<Provider, "displayName" | "email" | "timezone" | "status">>;
    actor: Actor;
  }): Promise<Provider | null> {
    const existing = await this.catalog.findProviderById(input.tenantId, input.providerId);
    if (existing === null) {
      return null;
    }
    const updated: Provider = { ...existing, ...input.patch };
    await this.catalog.updateProvider(updated);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.provider-updated",
      "provider",
      updated.id,
    );
    return updated;
  }

  /** Apply a partial update to a resource (admin edit / active toggle). */
  async updateResource(input: {
    tenantId: string;
    resourceId: string;
    patch: Partial<Pick<Resource, "name" | "quantity" | "status">>;
    actor: Actor;
  }): Promise<Resource | null> {
    const existing = (await this.catalog.listResources(input.tenantId)).find(
      (resource) => resource.id === input.resourceId,
    );
    if (existing === undefined) {
      return null;
    }
    const updated: Resource = { ...existing, ...input.patch };
    validateResource(updated);
    await this.catalog.updateResource(updated);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.resource-updated",
      "resource",
      updated.id,
    );
    return updated;
  }

  /** Remove a provider's assignment to a service. */
  async unassignProvider(input: {
    tenantId: string;
    serviceId: string;
    providerId: string;
    actor: Actor;
  }): Promise<void> {
    await this.catalog.unassignProvider(input.tenantId, input.serviceId, input.providerId);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.provider-unassigned",
      "service",
      input.serviceId,
      { providerId: input.providerId },
    );
  }

  async setProviderSchedule(input: {
    tenantId: string;
    providerId: string;
    entries: ProviderScheduleEntry[];
    actor: Actor;
  }): Promise<void> {
    for (const entry of input.entries) {
      validateScheduleEntry(entry);
    }
    await this.catalog.setProviderSchedule(input.tenantId, input.providerId, input.entries);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.provider-schedule-updated",
      "provider",
      input.providerId,
    );
  }

  async assignProvider(input: {
    tenantId: string;
    serviceId: string;
    providerId: string;
    actor: Actor;
  }): Promise<void> {
    await this.catalog.assignProvider({
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      providerId: input.providerId,
      status: "active",
    });
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.provider-assigned",
      "service",
      input.serviceId,
      {
        providerId: input.providerId,
      },
    );
  }

  async setProviderLocations(input: {
    tenantId: string;
    providerId: string;
    locationIds: string[];
    actor: Actor;
  }): Promise<void> {
    await this.catalog.setProviderLocations(input.tenantId, input.providerId, input.locationIds);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.provider-locations-updated",
      "provider",
      input.providerId,
      { locationCount: input.locationIds.length },
    );
  }

  private async audit(
    tenantId: string,
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const event = createDomainEvent({ tenantId, type: action, actor, payload: { entityId } });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action,
        entityType,
        entityId,
        ...(metadata ? { metadata } : {}),
      }),
    );
  }
}
