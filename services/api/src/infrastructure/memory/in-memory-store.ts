/**
 * In-memory adapter for the tenant and catalog repository ports.
 *
 * v1 persistence stand-in for tests and local development; the Drizzle/RLS
 * adapter in `packages/persistence` replaces it without touching application
 * code. Methods mirror what tenant-scoped SQL queries will do, so every lookup
 * filters by tenantId explicitly.
 */

import type {
  Category,
  Extra,
  Resource,
  Service,
  ServiceProvider,
} from "@saas-reservas/domain/catalog/service";
import type { Provider, ProviderScheduleEntry } from "@saas-reservas/domain/providers/provider";
import { intervalsOverlap, type Interval } from "@saas-reservas/domain/scheduling/time";
import type { Tenant, TenantDomain } from "@saas-reservas/domain/tenancy/tenant";
import type { ResolvedTenant, TenantLookup } from "../tenancy/tenant-resolver.js";
import type { CatalogRepository } from "../../application/catalog/catalog-service.js";
import type {
  ResourceHubRepository,
  ResourceWithHub,
} from "../../application/catalog/resource-hub-service.js";
import type { ResourceHubAssociations } from "@saas-reservas/domain/catalog/resource-hub";
import type { TenantRepository } from "../../application/tenancy/tenant-admin-service.js";
import type { ResourceAllocation } from "../../application/scheduling/availability-engine.js";

interface ProviderBusyEntry extends Interval {
  tenantId: string;
  providerId: string;
  bookingId?: string;
}

interface AllocationEntry extends ResourceAllocation {
  tenantId: string;
  resourceId: string;
  bookingId?: string;
}

export class InMemoryStore implements TenantRepository, CatalogRepository, ResourceHubRepository {
  private readonly tenants = new Map<string, Tenant>();
  private readonly domains = new Map<string, TenantDomain>();
  private readonly categories: Category[] = [];
  private readonly services: Service[] = [];
  private readonly extras: Extra[] = [];
  private readonly resources: Resource[] = [];
  private readonly providers: Provider[] = [];
  private readonly schedules = new Map<string, ProviderScheduleEntry[]>();
  private readonly serviceProviders: ServiceProvider[] = [];
  private readonly providerLocations: {
    tenantId: string;
    providerId: string;
    locationId: string;
  }[] = [];
  private readonly providerBusy: ProviderBusyEntry[] = [];
  private readonly allocations: AllocationEntry[] = [];
  // Resource hub model (ADR-0016): resource-owned associations.
  private readonly resourceServices: { tenantId: string; resourceId: string; serviceId: string }[] =
    [];
  private readonly resourceLocations: {
    tenantId: string;
    resourceId: string;
    locationId: string;
  }[] = [];
  private readonly resourceEmployees: {
    tenantId: string;
    resourceId: string;
    providerId: string;
  }[] = [];

  // --- TenantRepository ---

  insertTenant(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.id, tenant);
    return Promise.resolve();
  }

  updateTenant(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.id, tenant);
    return Promise.resolve();
  }

  findTenantById(tenantId: string): Promise<Tenant | null> {
    return Promise.resolve(this.tenants.get(tenantId) ?? null);
  }

  findTenantBySlug(slug: string): Promise<Tenant | null> {
    for (const tenant of this.tenants.values()) {
      if (tenant.slug === slug) {
        return Promise.resolve(tenant);
      }
    }
    return Promise.resolve(null);
  }

  insertDomain(domain: TenantDomain): Promise<void> {
    this.domains.set(domain.hostname, domain);
    return Promise.resolve();
  }

  findDomainByHostname(hostname: string): Promise<TenantDomain | null> {
    return Promise.resolve(this.domains.get(hostname) ?? null);
  }

  // --- TenantLookup for the request tenant resolver ---

  tenantLookup(): TenantLookup {
    const toResolved = (tenant: Tenant): ResolvedTenant => ({
      tenantId: tenant.id,
      slug: tenant.slug,
      status: tenant.status,
    });
    return {
      findById: async (tenantId) => {
        const tenant = await this.findTenantById(tenantId);
        return tenant === null ? null : toResolved(tenant);
      },
      findBySubdomain: async (slug) => {
        const tenant = await this.findTenantBySlug(slug);
        return tenant === null ? null : toResolved(tenant);
      },
      findByCustomDomain: async (hostname) => {
        const domain = await this.findDomainByHostname(hostname);
        if (domain?.verificationStatus !== "verified") {
          return null;
        }
        const tenant = await this.findTenantById(domain.tenantId);
        return tenant === null ? null : toResolved(tenant);
      },
    };
  }

  // --- CatalogRepository ---

  insertCategory(category: Category): Promise<void> {
    this.categories.push(category);
    return Promise.resolve();
  }

  insertService(service: Service): Promise<void> {
    this.services.push(service);
    return Promise.resolve();
  }

  insertExtra(extra: Extra): Promise<void> {
    this.extras.push(extra);
    return Promise.resolve();
  }

  insertResource(resource: Resource): Promise<void> {
    this.resources.push(resource);
    return Promise.resolve();
  }

  insertProvider(provider: Provider): Promise<void> {
    this.providers.push(provider);
    return Promise.resolve();
  }

  setProviderSchedule(
    tenantId: string,
    providerId: string,
    entries: ProviderScheduleEntry[],
  ): Promise<void> {
    this.schedules.set(`${tenantId}:${providerId}`, entries);
    return Promise.resolve();
  }

  assignProvider(link: ServiceProvider): Promise<void> {
    this.serviceProviders.push(link);
    return Promise.resolve();
  }

  setProviderLocations(tenantId: string, providerId: string, locationIds: string[]): Promise<void> {
    const kept = this.providerLocations.filter(
      (link) => !(link.tenantId === tenantId && link.providerId === providerId),
    );
    this.providerLocations.length = 0;
    this.providerLocations.push(
      ...kept,
      ...locationIds.map((locationId) => ({ tenantId, providerId, locationId })),
    );
    return Promise.resolve();
  }

  listProviderLocationIds(tenantId: string, providerId: string): Promise<string[]> {
    return Promise.resolve(
      this.providerLocations
        .filter((link) => link.tenantId === tenantId && link.providerId === providerId)
        .map((link) => link.locationId),
    );
  }

  findProviderById(tenantId: string, providerId: string): Promise<Provider | null> {
    return Promise.resolve(
      this.providers.find(
        (provider) => provider.tenantId === tenantId && provider.id === providerId,
      ) ?? null,
    );
  }

  findServiceById(tenantId: string, serviceId: string): Promise<Service | null> {
    return Promise.resolve(
      this.services.find((service) => service.tenantId === tenantId && service.id === serviceId) ??
        null,
    );
  }

  listExtras(tenantId: string, serviceId: string, extraIds: string[]): Promise<Extra[]> {
    return Promise.resolve(
      this.extras.filter(
        (extra) =>
          extra.tenantId === tenantId &&
          extra.serviceId === serviceId &&
          extra.status === "active" &&
          extraIds.includes(extra.id),
      ),
    );
  }

  listActiveProvidersForService(tenantId: string, serviceId: string): Promise<Provider[]> {
    const providerIds = new Set(
      this.serviceProviders
        .filter(
          (link) =>
            link.tenantId === tenantId && link.serviceId === serviceId && link.status === "active",
        )
        .map((link) => link.providerId),
    );
    return Promise.resolve(
      this.providers.filter(
        (provider) =>
          provider.tenantId === tenantId &&
          provider.status === "active" &&
          providerIds.has(provider.id),
      ),
    );
  }

  listScheduleEntries(tenantId: string, providerId: string): Promise<ProviderScheduleEntry[]> {
    return Promise.resolve(this.schedules.get(`${tenantId}:${providerId}`) ?? []);
  }

  listProviderBusy(tenantId: string, providerId: string, range: Interval): Promise<Interval[]> {
    return Promise.resolve(
      this.providerBusy.filter(
        (busy) =>
          busy.tenantId === tenantId &&
          busy.providerId === providerId &&
          intervalsOverlap(busy, range),
      ),
    );
  }

  listResourceAllocations(
    tenantId: string,
    resourceId: string,
    range: Interval,
  ): Promise<ResourceAllocation[]> {
    return Promise.resolve(
      this.allocations.filter(
        (allocation) =>
          allocation.tenantId === tenantId &&
          allocation.resourceId === resourceId &&
          intervalsOverlap(allocation, range),
      ),
    );
  }

  // --- ResourceHubRepository (ADR-0016) ---

  private replaceAssociation<T extends { tenantId: string; resourceId: string }>(
    store: T[],
    tenantId: string,
    resourceId: string,
    next: T[],
  ): void {
    const kept = store.filter(
      (row) => !(row.tenantId === tenantId && row.resourceId === resourceId),
    );
    store.length = 0;
    store.push(...kept, ...next);
  }

  setResourceServices(tenantId: string, resourceId: string, serviceIds: string[]): Promise<void> {
    this.replaceAssociation(
      this.resourceServices,
      tenantId,
      resourceId,
      serviceIds.map((serviceId) => ({ tenantId, resourceId, serviceId })),
    );
    return Promise.resolve();
  }

  setResourceLocations(tenantId: string, resourceId: string, locationIds: string[]): Promise<void> {
    this.replaceAssociation(
      this.resourceLocations,
      tenantId,
      resourceId,
      locationIds.map((locationId) => ({ tenantId, resourceId, locationId })),
    );
    return Promise.resolve();
  }

  setResourceEmployees(tenantId: string, resourceId: string, providerIds: string[]): Promise<void> {
    this.replaceAssociation(
      this.resourceEmployees,
      tenantId,
      resourceId,
      providerIds.map((providerId) => ({ tenantId, resourceId, providerId })),
    );
    return Promise.resolve();
  }

  getResourceHub(tenantId: string, resourceId: string): Promise<ResourceHubAssociations> {
    return Promise.resolve(this.hubFor(tenantId, resourceId));
  }

  listHubResourcesForService(tenantId: string, serviceId: string): Promise<ResourceWithHub[]> {
    const result: ResourceWithHub[] = [];
    for (const link of this.resourceServices) {
      if (link.tenantId !== tenantId || link.serviceId !== serviceId) {
        continue;
      }
      const resource = this.resources.find(
        (candidate) => candidate.tenantId === tenantId && candidate.id === link.resourceId,
      );
      if (resource?.status === "active") {
        result.push({ resource, hub: this.hubFor(tenantId, resource.id) });
      }
    }
    return Promise.resolve(result);
  }

  private hubFor(tenantId: string, resourceId: string): ResourceHubAssociations {
    const match = <T extends { tenantId: string; resourceId: string }>(store: T[]): T[] =>
      store.filter((row) => row.tenantId === tenantId && row.resourceId === resourceId);
    return {
      serviceIds: match(this.resourceServices).map((row) => row.serviceId),
      locationIds: match(this.resourceLocations).map((row) => row.locationId),
      employeeIds: match(this.resourceEmployees).map((row) => row.providerId),
    };
  }

  // --- Simulation helpers (stand in for booking/checkout flows from US2) ---

  addProviderBusy(tenantId: string, providerId: string, interval: Interval): void {
    this.providerBusy.push({ tenantId, providerId, ...interval });
  }

  addResourceAllocation(
    tenantId: string,
    resourceId: string,
    allocation: ResourceAllocation,
  ): void {
    this.allocations.push({ tenantId, resourceId, ...allocation });
  }

  /** OccupancyRecorder port: persist confirmed booking occupancy (buffers included). */
  recordBookingOccupancy(
    tenantId: string,
    providerId: string,
    occupied: Interval,
    resources: { resourceId: string; units: number }[],
    bookingId?: string,
  ): void {
    this.providerBusy.push({
      tenantId,
      providerId,
      ...occupied,
      ...(bookingId !== undefined ? { bookingId } : {}),
    });
    for (const resource of resources) {
      this.allocations.push({
        tenantId,
        resourceId: resource.resourceId,
        ...occupied,
        units: resource.units,
        ...(bookingId !== undefined ? { bookingId } : {}),
      });
    }
  }

  /** OccupancyRecorder port: free a canceled/rescheduled booking's occupancy. */
  releaseBookingOccupancy(tenantId: string, bookingId: string): void {
    const keepBusy = this.providerBusy.filter(
      (busy) => !(busy.tenantId === tenantId && busy.bookingId === bookingId),
    );
    this.providerBusy.length = 0;
    this.providerBusy.push(...keepBusy);
    const keepAllocations = this.allocations.filter(
      (allocation) => !(allocation.tenantId === tenantId && allocation.bookingId === bookingId),
    );
    this.allocations.length = 0;
    this.allocations.push(...keepAllocations);
  }
}
