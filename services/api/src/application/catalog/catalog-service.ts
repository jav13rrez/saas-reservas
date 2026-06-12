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
  type ServiceResource,
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
  setProviderSchedule(
    tenantId: string,
    providerId: string,
    entries: ProviderScheduleEntry[],
  ): Promise<void>;
  assignProvider(link: ServiceProvider): Promise<void>;
  linkResource(link: ServiceResource): Promise<void>;

  findServiceById(tenantId: string, serviceId: string): Promise<Service | null>;
  findProviderById(tenantId: string, providerId: string): Promise<Provider | null>;
  listExtras(tenantId: string, serviceId: string, extraIds: string[]): Promise<Extra[]>;
  listActiveProvidersForService(tenantId: string, serviceId: string): Promise<Provider[]>;
  listScheduleEntries(tenantId: string, providerId: string): Promise<ProviderScheduleEntry[]>;
  listProviderBusy(tenantId: string, providerId: string, range: Interval): Promise<Interval[]>;
  listResourceDemands(
    tenantId: string,
    serviceId: string,
  ): Promise<{ resource: Resource; units: number }[]>;
  listResourceAllocations(
    tenantId: string,
    resourceId: string,
    range: Interval,
  ): Promise<ResourceAllocation[]>;
}

export class CatalogService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly events: EventSink,
  ) {}

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

  async linkResource(input: {
    tenantId: string;
    serviceId: string;
    resourceId: string;
    units?: number;
    actor: Actor;
  }): Promise<void> {
    await this.catalog.linkResource({
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      resourceId: input.resourceId,
      units: input.units ?? 1,
    });
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.resource-linked",
      "service",
      input.serviceId,
      {
        resourceId: input.resourceId,
      },
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
