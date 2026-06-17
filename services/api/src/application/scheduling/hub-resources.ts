/**
 * Hub resource selection for the availability engine and checkout (ADR-0016).
 *
 * The hub treats the resources that serve a service as an interchangeable pool:
 * a booking consumes one unit and is allowed when at least one eligible,
 * location-compatible resource has a free unit over the occupied interval. The
 * availability engine models "all demands must be satisfiable", so the pool is
 * collapsed into a single synthetic demand whose quantity is the sum of the
 * candidates' quantities and whose existing allocations are the union of theirs;
 * `unitsInUse + 1 <= totalQuantity` then expresses "at least one free unit".
 *
 * Provider location compatibility is a no-op until the canonical Provider gains
 * locations (the legacy domain has none); an empty provider-location set means
 * "any location", so it never wrongly blocks.
 */

import {
  resourceAllowsProvider,
  resourceCompatibleWithLocations,
} from "@saas-reservas/domain/catalog/resource-hub";
import type { ResourceWithHub } from "../catalog/resource-hub-service.js";

/** Synthetic resource id for the pooled hub demand fed to the engine. */
export const HUB_POOL_RESOURCE_ID = "__hub_pool__";

/**
 * Resources that serve the service AND that the provider may use at a compatible
 * location. An empty result when `serving` is non-empty means the provider is
 * eligible for none — zero availability.
 */
export function hubCandidates(
  serving: ResourceWithHub[],
  providerId: string,
  providerLocationIds: string[],
): ResourceWithHub[] {
  return serving.filter(
    (candidate) =>
      resourceAllowsProvider(candidate.hub, providerId) &&
      resourceCompatibleWithLocations(candidate.hub, providerLocationIds),
  );
}
