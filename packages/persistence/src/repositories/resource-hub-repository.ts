/**
 * Drizzle adapter for the ResourceHubRepository port (ADR-0016). Every method
 * runs inside a tenant-scoped transaction; RLS enforces isolation. Mirrors the
 * resource-owned associations in infra/postgres/004-resource-hub.sql.
 */

import { and, eq } from "drizzle-orm";
import type { Resource } from "@saas-reservas/domain/catalog/service";
import type { ResourceHubAssociations } from "@saas-reservas/domain/catalog/resource-hub";
import type { TenantDb, Tx } from "../db.js";
import { resourceEmployees, resourceLocations, resourceServices, resources } from "../schema.js";

interface ResourceWithHub {
  resource: Resource;
  hub: ResourceHubAssociations;
}

/** Normalize the nullable DB location_id to the optional domain shape. */
function toResource(row: typeof resources.$inferSelect): Resource {
  const { locationId, ...rest } = row;
  return locationId === null ? rest : { ...rest, locationId };
}

export class DrizzleResourceHubRepository {
  constructor(private readonly db: TenantDb) {}

  async setResourceServices(
    tenantId: string,
    resourceId: string,
    serviceIds: string[],
  ): Promise<void> {
    await this.db.withTenant(tenantId, async (tx) => {
      await tx.delete(resourceServices).where(eq(resourceServices.resourceId, resourceId));
      if (serviceIds.length > 0) {
        await tx
          .insert(resourceServices)
          .values(serviceIds.map((serviceId) => ({ tenantId, resourceId, serviceId })));
      }
    });
  }

  async setResourceLocations(
    tenantId: string,
    resourceId: string,
    locationIds: string[],
  ): Promise<void> {
    await this.db.withTenant(tenantId, async (tx) => {
      await tx.delete(resourceLocations).where(eq(resourceLocations.resourceId, resourceId));
      if (locationIds.length > 0) {
        await tx
          .insert(resourceLocations)
          .values(locationIds.map((locationId) => ({ tenantId, resourceId, locationId })));
      }
    });
  }

  async setResourceEmployees(
    tenantId: string,
    resourceId: string,
    providerIds: string[],
  ): Promise<void> {
    await this.db.withTenant(tenantId, async (tx) => {
      await tx.delete(resourceEmployees).where(eq(resourceEmployees.resourceId, resourceId));
      if (providerIds.length > 0) {
        await tx
          .insert(resourceEmployees)
          .values(providerIds.map((providerId) => ({ tenantId, resourceId, providerId })));
      }
    });
  }

  async getResourceHub(tenantId: string, resourceId: string): Promise<ResourceHubAssociations> {
    return this.db.withTenant(tenantId, (tx) => hubForResource(tx, resourceId));
  }

  async listHubResourcesForService(
    tenantId: string,
    serviceId: string,
  ): Promise<ResourceWithHub[]> {
    return this.db.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({ resource: resources })
        .from(resourceServices)
        .innerJoin(resources, eq(resourceServices.resourceId, resources.id))
        .where(and(eq(resourceServices.serviceId, serviceId), eq(resources.status, "active")));

      const result: ResourceWithHub[] = [];
      for (const row of rows) {
        const resource = toResource(row.resource);
        result.push({ resource, hub: await hubForResource(tx, resource.id) });
      }
      return result;
    });
  }
}

/** Read all hub associations for one resource within an existing transaction. */
async function hubForResource(tx: Tx, resourceId: string): Promise<ResourceHubAssociations> {
  const [services, locations, employees] = await Promise.all([
    tx
      .select({ serviceId: resourceServices.serviceId })
      .from(resourceServices)
      .where(eq(resourceServices.resourceId, resourceId)),
    tx
      .select({ locationId: resourceLocations.locationId })
      .from(resourceLocations)
      .where(eq(resourceLocations.resourceId, resourceId)),
    tx
      .select({ providerId: resourceEmployees.providerId })
      .from(resourceEmployees)
      .where(eq(resourceEmployees.resourceId, resourceId)),
  ]);
  return {
    serviceIds: services.map((row) => row.serviceId),
    locationIds: locations.map((row) => row.locationId),
    employeeIds: employees.map((row) => row.providerId),
  };
}
