/**
 * Drizzle adapter for the CatalogRepository port. Every method runs inside a
 * tenant-scoped transaction; RLS enforces isolation even if a predicate were
 * ever wrong.
 */

import { and, eq, gt, inArray, lt } from "drizzle-orm";
import type {
  Category,
  Extra,
  Resource,
  Service,
  ServiceProvider,
} from "@saas-reservas/domain/catalog/service";
import type { Provider, ProviderScheduleEntry } from "@saas-reservas/domain/providers/provider";
import type { Interval } from "@saas-reservas/domain/scheduling/time";
import type { TenantDb } from "../db.js";
import {
  extras,
  providerBusy,
  providers,
  providerSchedules,
  resourceAllocations,
  resources,
  categories,
  providerLocations,
  serviceProviders,
  services,
} from "../schema.js";

interface ResourceAllocation extends Interval {
  units: number;
}

export class DrizzleCatalogRepository {
  constructor(private readonly db: TenantDb) {}

  async insertCategory(category: Category): Promise<void> {
    await this.db.withTenant(category.tenantId, (tx) => tx.insert(categories).values(category));
  }

  async insertService(service: Service): Promise<void> {
    await this.db.withTenant(service.tenantId, (tx) => tx.insert(services).values(service));
  }

  async insertExtra(extra: Extra): Promise<void> {
    await this.db.withTenant(extra.tenantId, (tx) => tx.insert(extras).values(extra));
  }

  async insertResource(resource: Resource): Promise<void> {
    await this.db.withTenant(resource.tenantId, (tx) => tx.insert(resources).values(resource));
  }

  async insertProvider(provider: Provider): Promise<void> {
    await this.db.withTenant(provider.tenantId, (tx) => tx.insert(providers).values(provider));
  }

  async setProviderSchedule(
    tenantId: string,
    providerId: string,
    entries: ProviderScheduleEntry[],
  ): Promise<void> {
    await this.db.withTenant(tenantId, (tx) =>
      tx
        .insert(providerSchedules)
        .values({ tenantId, providerId, entries })
        .onConflictDoUpdate({
          target: [providerSchedules.tenantId, providerSchedules.providerId],
          set: { entries },
        }),
    );
  }

  async assignProvider(link: ServiceProvider): Promise<void> {
    await this.db.withTenant(link.tenantId, (tx) => tx.insert(serviceProviders).values(link));
  }

  async setProviderLocations(
    tenantId: string,
    providerId: string,
    locationIds: string[],
  ): Promise<void> {
    await this.db.withTenant(tenantId, async (tx) => {
      await tx.delete(providerLocations).where(eq(providerLocations.providerId, providerId));
      if (locationIds.length > 0) {
        await tx
          .insert(providerLocations)
          .values(locationIds.map((locationId) => ({ tenantId, providerId, locationId })));
      }
    });
  }

  async listProviderLocationIds(tenantId: string, providerId: string): Promise<string[]> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .select({ locationId: providerLocations.locationId })
        .from(providerLocations)
        .where(eq(providerLocations.providerId, providerId)),
    );
    return rows.map((row) => row.locationId);
  }

  async findProviderById(tenantId: string, providerId: string): Promise<Provider | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(providers).where(eq(providers.id, providerId)).limit(1),
    );
    return rows[0] ?? null;
  }

  async findServiceById(tenantId: string, serviceId: string): Promise<Service | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(services).where(eq(services.id, serviceId)).limit(1),
    );
    return rows[0] ?? null;
  }

  async listExtras(tenantId: string, serviceId: string, extraIds: string[]): Promise<Extra[]> {
    if (extraIds.length === 0) {
      return [];
    }
    return this.db.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(extras)
        .where(
          and(
            eq(extras.serviceId, serviceId),
            eq(extras.status, "active"),
            inArray(extras.id, extraIds),
          ),
        ),
    );
  }

  async listActiveProvidersForService(tenantId: string, serviceId: string): Promise<Provider[]> {
    return this.db.withTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({ provider: providers })
        .from(serviceProviders)
        .innerJoin(providers, eq(serviceProviders.providerId, providers.id))
        .where(
          and(
            eq(serviceProviders.serviceId, serviceId),
            eq(serviceProviders.status, "active"),
            eq(providers.status, "active"),
          ),
        );
      return rows.map((row) => row.provider);
    });
  }

  // --- Admin read model ---

  async listCategories(tenantId: string): Promise<Category[]> {
    return this.db.withTenant(tenantId, (tx) => tx.select().from(categories));
  }

  async listServices(tenantId: string): Promise<Service[]> {
    return this.db.withTenant(tenantId, (tx) => tx.select().from(services));
  }

  async listProviders(tenantId: string): Promise<Provider[]> {
    return this.db.withTenant(tenantId, (tx) => tx.select().from(providers));
  }

  async listResources(tenantId: string): Promise<Resource[]> {
    return this.db.withTenant(tenantId, (tx) => tx.select().from(resources));
  }

  async listProviderServiceIds(tenantId: string, providerId: string): Promise<string[]> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .select({ serviceId: serviceProviders.serviceId })
        .from(serviceProviders)
        .where(
          and(eq(serviceProviders.providerId, providerId), eq(serviceProviders.status, "active")),
        ),
    );
    return rows.map((row) => row.serviceId);
  }

  async listScheduleEntries(
    tenantId: string,
    providerId: string,
  ): Promise<ProviderScheduleEntry[]> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(providerSchedules)
        .where(eq(providerSchedules.providerId, providerId))
        .limit(1),
    );
    return rows[0]?.entries ?? [];
  }

  async listProviderBusy(
    tenantId: string,
    providerId: string,
    range: Interval,
  ): Promise<Interval[]> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(providerBusy)
        .where(
          and(
            eq(providerBusy.providerId, providerId),
            lt(providerBusy.startAt, new Date(range.end)),
            gt(providerBusy.endAt, new Date(range.start)),
          ),
        ),
    );
    return rows.map((row) => ({ start: row.startAt.getTime(), end: row.endAt.getTime() }));
  }

  async listResourceAllocations(
    tenantId: string,
    resourceId: string,
    range: Interval,
  ): Promise<ResourceAllocation[]> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(resourceAllocations)
        .where(
          and(
            eq(resourceAllocations.resourceId, resourceId),
            lt(resourceAllocations.startAt, new Date(range.end)),
            gt(resourceAllocations.endAt, new Date(range.start)),
          ),
        ),
    );
    return rows.map((row) => ({
      start: row.startAt.getTime(),
      end: row.endAt.getTime(),
      units: row.units,
    }));
  }

  /** OccupancyRecorder port: persist confirmed booking occupancy atomically. */
  async recordBookingOccupancy(
    tenantId: string,
    providerId: string,
    occupied: Interval,
    resourceDemands: { resourceId: string; units: number }[],
    bookingId?: string,
  ): Promise<void> {
    await this.db.withTenant(tenantId, async (tx) => {
      await tx.insert(providerBusy).values({
        tenantId,
        providerId,
        bookingId: bookingId ?? null,
        startAt: new Date(occupied.start),
        endAt: new Date(occupied.end),
      });
      for (const demand of resourceDemands) {
        await tx.insert(resourceAllocations).values({
          tenantId,
          resourceId: demand.resourceId,
          bookingId: bookingId ?? null,
          startAt: new Date(occupied.start),
          endAt: new Date(occupied.end),
          units: demand.units,
        });
      }
    });
  }

  /** OccupancyRecorder port: free a canceled/rescheduled booking's occupancy. */
  async releaseBookingOccupancy(tenantId: string, bookingId: string): Promise<void> {
    await this.db.withTenant(tenantId, async (tx) => {
      await tx.delete(providerBusy).where(eq(providerBusy.bookingId, bookingId));
      await tx.delete(resourceAllocations).where(eq(resourceAllocations.bookingId, bookingId));
    });
  }
}
