/**
 * Availability application service: assembles the engine input for one tenant,
 * service, date, and provider, applying the single-provider auto-selection rule
 * (spec US1 scenario 2).
 */

import type { Provider } from "@saas-reservas/domain/providers/provider";
import {
  parseIsoDate,
  wallTimeToUtcMs,
  type Interval,
} from "@saas-reservas/domain/scheduling/time";
import type { CatalogRepository } from "../catalog/catalog-service.js";
import type { ResourceHubRepository } from "../catalog/resource-hub-service.js";
import {
  computeAvailableSlots,
  type AvailableSlot,
  type ResourceDemand,
} from "./availability-engine.js";
import { HUB_POOL_RESOURCE_ID, hubCandidates } from "./hub-resources.js";

const DAY_MS = 86_400_000;

export interface AvailabilityQuery {
  tenantId: string;
  serviceId: string;
  /** "YYYY-MM-DD" in the scheduling time zone. */
  date: string;
  providerId?: string;
  extraIds?: string[];
  /** Tenant default time zone, used when the provider has none. */
  tenantTimezone: string;
}

export type AvailabilityResult =
  | { ok: true; provider: Provider; providerSelection: "auto" | "explicit"; slots: AvailableSlot[] }
  | { ok: false; reason: "service-not-found" | "provider-required" | "provider-not-assigned" };

export interface WidgetConfig {
  serviceId: string;
  /** Hidden when exactly one active provider serves the service (US1 scenario 2). */
  providerSelection: "hidden" | "required";
  providers: { id: string; displayName: string }[];
}

export class AvailabilityService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly hub: ResourceHubRepository,
  ) {}

  async widgetConfig(tenantId: string, serviceId: string): Promise<WidgetConfig | null> {
    const service = await this.catalog.findServiceById(tenantId, serviceId);
    if (service?.status !== "active") {
      return null;
    }
    const providers = await this.catalog.listActiveProvidersForService(tenantId, serviceId);
    return {
      serviceId,
      providerSelection: providers.length === 1 ? "hidden" : "required",
      providers: providers.map((provider) => ({
        id: provider.id,
        displayName: provider.displayName,
      })),
    };
  }

  async availability(query: AvailabilityQuery): Promise<AvailabilityResult> {
    const service = await this.catalog.findServiceById(query.tenantId, query.serviceId);
    if (service?.status !== "active") {
      return { ok: false, reason: "service-not-found" };
    }
    const providers = await this.catalog.listActiveProvidersForService(
      query.tenantId,
      query.serviceId,
    );

    let provider: Provider | undefined;
    let providerSelection: "auto" | "explicit";
    if (query.providerId !== undefined) {
      provider = providers.find((candidate) => candidate.id === query.providerId);
      providerSelection = "explicit";
      if (provider === undefined) {
        return { ok: false, reason: "provider-not-assigned" };
      }
    } else if (providers.length === 1) {
      [provider] = providers;
      providerSelection = "auto";
    } else {
      return { ok: false, reason: "provider-required" };
    }
    if (provider === undefined) {
      return { ok: false, reason: "provider-required" };
    }

    const timezone = provider.timezone || query.tenantTimezone;
    const selectedExtras = await this.catalog.listExtras(
      query.tenantId,
      query.serviceId,
      query.extraIds ?? [],
    );
    const scheduleEntries = await this.catalog.listScheduleEntries(query.tenantId, provider.id);

    // Cover the full local day plus slack for time zone offsets.
    const dayStart = wallTimeToUtcMs(parseIsoDate(query.date), 0, timezone);
    const range: Interval = { start: dayStart - DAY_MS, end: dayStart + 2 * DAY_MS };

    const providerBusy = await this.catalog.listProviderBusy(query.tenantId, provider.id, range);

    // Hub read model (ADR-0016): the resources that serve this service form an
    // interchangeable pool, collapsed into one synthetic demand for the engine.
    const resources = await this.resourcePoolDemand(
      query.tenantId,
      query.serviceId,
      provider.id,
      range,
    );

    const slots = computeAvailableSlots({
      date: query.date,
      timezone,
      service,
      selectedExtras,
      scheduleEntries,
      providerBusy,
      resources,
    });
    return { ok: true, provider, providerSelection, slots };
  }

  /**
   * Builds the pooled hub demand. Returns `[]` when no resource serves the
   * service (no constraint); a zero-capacity demand when resources exist but the
   * provider is eligible for none (zero availability); otherwise one synthetic
   * demand whose quantity/allocations are the union of the eligible pool.
   */
  private async resourcePoolDemand(
    tenantId: string,
    serviceId: string,
    providerId: string,
    range: Interval,
  ): Promise<ResourceDemand[]> {
    const serving = await this.hub.listHubResourcesForService(tenantId, serviceId);
    if (serving.length === 0) {
      return [];
    }
    const providerLocationIds = await this.catalog.listProviderLocationIds(tenantId, providerId);
    const candidates = hubCandidates(serving, providerId, providerLocationIds);
    if (candidates.length === 0) {
      return [
        {
          resourceId: HUB_POOL_RESOURCE_ID,
          resourceQuantity: 0,
          unitsRequired: 1,
          existingAllocations: [],
        },
      ];
    }
    const perResource = await Promise.all(
      candidates.map((candidate) =>
        this.catalog.listResourceAllocations(tenantId, candidate.resource.id, range),
      ),
    );
    return [
      {
        resourceId: HUB_POOL_RESOURCE_ID,
        resourceQuantity: candidates.reduce((sum, c) => sum + c.resource.quantity, 0),
        unitsRequired: 1,
        existingAllocations: perResource.flat(),
      },
    ];
  }
}
