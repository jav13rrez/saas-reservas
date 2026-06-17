/**
 * Resource hub model (ADR-0016).
 *
 * The Resource is the single configuration hub: it declares which services
 * consume it (`serviceIds`), which sites it exists at (`locationIds`), and which
 * providers may use it (`employeeIds`). This is the canonical-layer counterpart
 * of the admin console hub (`apps/admin/src/server/demo-store.ts`).
 *
 * Empty-array semantics (aligned with the admin store):
 *  - `serviceIds` empty  => the resource is demanded by no service.
 *  - `locationIds` empty => the resource exists at any location.
 *  - `employeeIds` empty => any provider may use the resource.
 *
 * This module is ADDITIVE. The legacy direction from ADR-0015 model B
 * (`service.resourceId` / `provider.resourceIds`, persisted as `service_resources`
 * + `provider_resources`) is retained for backward compatibility until the
 * public widget and Fastify `/v1/admin/*` routes are cut over to the hub. The
 * availability engine still consumes the model-B read model; these helpers feed
 * the hub allocation path (mirroring `createBooking` in the admin store).
 */

/** Hub associations a resource declares (without the resource id). */
export interface ResourceHubAssociations {
  /** Services whose bookings consume one unit of this resource (empty = none). */
  serviceIds: string[];
  /** Sites where the resource exists (empty = any location). */
  locationIds: string[];
  /** Providers eligible to use the resource (empty = any provider). */
  employeeIds: string[];
}

/** A resource id together with its hub associations. */
export interface ResourceHub extends ResourceHubAssociations {
  resourceId: string;
}

/** Whether a booking of `serviceId` consumes this resource. */
export function resourceServesService(hub: ResourceHubAssociations, serviceId: string): boolean {
  return hub.serviceIds.includes(serviceId);
}

/** Whether `providerId` may use this resource (empty employees = any provider). */
export function resourceAllowsProvider(hub: ResourceHubAssociations, providerId: string): boolean {
  return hub.employeeIds.length === 0 || hub.employeeIds.includes(providerId);
}

/**
 * Location compatibility by array intersection. An empty set on either side
 * means "any location": an empty resource side is location-agnostic, and an
 * empty candidate set means the booking does not constrain location. Otherwise
 * the resource must exist at one of the candidate locations.
 */
export function resourceCompatibleWithLocations(
  hub: ResourceHubAssociations,
  candidateLocationIds: string[],
): boolean {
  if (hub.locationIds.length === 0 || candidateLocationIds.length === 0) {
    return true;
  }
  const allowed = new Set(hub.locationIds);
  return candidateLocationIds.some((id) => allowed.has(id));
}

/**
 * Resources a booking consumes under the hub model: those that serve the
 * service, allow the provider, and are location compatible. Each consumes one
 * unit (the quantity partition and group booking are deferred — ADR-0016).
 */
export function hubResourcesForBooking(
  hubs: ResourceHub[],
  params: { serviceId: string; providerId: string; locationIds?: string[] },
): ResourceHub[] {
  const candidateLocationIds = params.locationIds ?? [];
  return hubs.filter(
    (hub) =>
      resourceServesService(hub, params.serviceId) &&
      resourceAllowsProvider(hub, params.providerId) &&
      resourceCompatibleWithLocations(hub, candidateLocationIds),
  );
}
