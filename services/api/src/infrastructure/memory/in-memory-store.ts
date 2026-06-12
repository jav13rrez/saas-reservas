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
  ServiceResource,
} from "@saas-reservas/domain/catalog/service";
import type { Provider, ProviderScheduleEntry } from "@saas-reservas/domain/providers/provider";
import { intervalsOverlap, type Interval } from "@saas-reservas/domain/scheduling/time";
import type { Tenant, TenantDomain } from "@saas-reservas/domain/tenancy/tenant";
import type { ResolvedTenant, TenantLookup } from "../tenancy/tenant-resolver.js";
import type { CatalogRepository } from "../../application/catalog/catalog-service.js";
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

export class InMemoryStore implements TenantRepository, CatalogRepository {
  private readonly tenants = new Map<string, Tenant>();
  private readonly domains = new Map<string, TenantDomain>();
  private readonly categories: Category[] = [];
  private readonly services: Service[] = [];
  private readonly extras: Extra[] = [];
  private readonly resources: Resource[] = [];
  private readonly providers: Provider[] = [];
  private readonly schedules = new Map<string, ProviderScheduleEntry[]>();
  private readonly serviceProviders: ServiceProvider[] = [];
  private readonly serviceResources: ServiceResource[] = [];
  private readonly providerBusy: ProviderBusyEntry[] = [];
  private readonly allocations: AllocationEntry[] = [];

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

  linkResource(link: ServiceResource): Promise<void> {
    this.serviceResources.push(link);
    return Promise.resolve();
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

  listResourceDemands(
    tenantId: string,
    serviceId: string,
  ): Promise<{ resource: Resource; units: number }[]> {
    const demands: { resource: Resource; units: number }[] = [];
    for (const link of this.serviceResources) {
      if (link.tenantId !== tenantId || link.serviceId !== serviceId) {
        continue;
      }
      const resource = this.resources.find(
        (candidate) => candidate.tenantId === tenantId && candidate.id === link.resourceId,
      );
      if (resource?.status === "active") {
        demands.push({ resource, units: link.units });
      }
    }
    return Promise.resolve(demands);
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
