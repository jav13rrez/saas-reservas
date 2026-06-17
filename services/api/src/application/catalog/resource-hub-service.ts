/**
 * Resource hub application service (ADR-0016).
 *
 * Configures the resource-owned N:M associations (services, locations,
 * employees) that make the Resource the single eligibility hub, and exposes the
 * read model the hub allocation path needs. Additive: this lives alongside the
 * legacy model-B catalog port; the availability engine is not changed here.
 */

import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import type { Resource } from "@saas-reservas/domain/catalog/service";
import type { ResourceHubAssociations } from "@saas-reservas/domain/catalog/resource-hub";
import type { EventSink } from "../events.js";

/** A resource together with its hub associations (read model for allocation). */
export interface ResourceWithHub {
  resource: Resource;
  hub: ResourceHubAssociations;
}

export interface ResourceHubRepository {
  /** Replace the services a resource serves. */
  setResourceServices(tenantId: string, resourceId: string, serviceIds: string[]): Promise<void>;
  /** Replace the sites a resource exists at. */
  setResourceLocations(tenantId: string, resourceId: string, locationIds: string[]): Promise<void>;
  /** Replace the providers eligible to use a resource. */
  setResourceEmployees(tenantId: string, resourceId: string, providerIds: string[]): Promise<void>;
  /** All hub associations for one resource (empty arrays when none). */
  getResourceHub(tenantId: string, resourceId: string): Promise<ResourceHubAssociations>;
  /** Active resources that serve a service, each with its full hub associations. */
  listHubResourcesForService(tenantId: string, serviceId: string): Promise<ResourceWithHub[]>;
}

export class ResourceHubService {
  constructor(
    private readonly hub: ResourceHubRepository,
    private readonly events: EventSink,
  ) {}

  async setServices(input: {
    tenantId: string;
    resourceId: string;
    serviceIds: string[];
    actor: Actor;
  }): Promise<void> {
    await this.hub.setResourceServices(input.tenantId, input.resourceId, input.serviceIds);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.resource-services-updated",
      input.resourceId,
      {
        serviceCount: input.serviceIds.length,
      },
    );
  }

  async setLocations(input: {
    tenantId: string;
    resourceId: string;
    locationIds: string[];
    actor: Actor;
  }): Promise<void> {
    await this.hub.setResourceLocations(input.tenantId, input.resourceId, input.locationIds);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.resource-locations-updated",
      input.resourceId,
      {
        locationCount: input.locationIds.length,
      },
    );
  }

  async setEmployees(input: {
    tenantId: string;
    resourceId: string;
    providerIds: string[];
    actor: Actor;
  }): Promise<void> {
    await this.hub.setResourceEmployees(input.tenantId, input.resourceId, input.providerIds);
    await this.audit(
      input.tenantId,
      input.actor,
      "catalog.resource-employees-updated",
      input.resourceId,
      {
        employeeCount: input.providerIds.length,
      },
    );
  }

  getHub(tenantId: string, resourceId: string): Promise<ResourceHubAssociations> {
    return this.hub.getResourceHub(tenantId, resourceId);
  }

  listResourcesForService(tenantId: string, serviceId: string): Promise<ResourceWithHub[]> {
    return this.hub.listHubResourcesForService(tenantId, serviceId);
  }

  private async audit(
    tenantId: string,
    actor: Actor,
    action: string,
    resourceId: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const event = createDomainEvent({
      tenantId,
      type: action,
      actor,
      payload: { entityId: resourceId },
    });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action,
        entityType: "resource",
        entityId: resourceId,
        ...(metadata ? { metadata } : {}),
      }),
    );
  }
}
