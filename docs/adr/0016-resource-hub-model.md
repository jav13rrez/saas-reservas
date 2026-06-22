# ADR-0016: Resource Hub Model — Partial Amelia Alignment

**Status:** Accepted
**Date:** 2026-06-16
**Supersedes:** the eligibility/association direction of ADR-0015 (model B) in the
admin console; ADR-0015's domain/persistence layer is not yet migrated (see Consequences).

## Context

A full sweep of the Amelia Premium admin console (notes in
`docs/analysis/amelia-ux-reference.md`) revealed that Amelia treats the
**Resource** as a configuration _hub_: a single Resource entity declares the
Services, Locations and Employees it applies to (each defaulting to "All"), plus
a quantity partition (`shared / per-service / per-location`) and a group-booking
usage toggle.

Our prior model (ADR-0015) spread the resource relationships across three
entities and two directions:

- `service.resourceId` (a service points to one resource, 1→1),
- `resource.locationId` (a resource lives at one site, 1→1),
- `provider.resourceIds` (a provider lists eligible resources — "model B").

This had two concrete pain points:

1. **A resource could not be shared by several services** (`service.resourceId`
   is 1→1) — e.g. a "therapy room" used by both consultation and therapy.
2. **A resource could not exist at several sites** (`resource.locationId` is 1→1).
3. **Eligibility lived in two places** conceptually: the provider declared
   `resourceIds`, but Amelia declares the inverse (`resource.employeeIds`),
   risking a duplicated/desynchronised source of truth.

## Decision

Adopt the hub model **partially** — the N:M relationships that resolve real
pain, but not the quantity partition or group booking.

### Adopted

- `AdminResource` becomes the hub:
  - `locationIds[]` — sites where the resource exists (empty = any location),
  - `serviceIds[]` — services whose bookings consume one unit (empty = none),
  - `employeeIds[]` — providers eligible to use it (empty = any provider).
- `AdminService` **loses** `resourceId` / `resourceUnits`. A service no longer
  points to a resource; the resource declares the service.
- `AdminProvider` **loses** `resourceIds`. Eligibility is declared from the
  resource side only — a single source of truth, aligned with Amelia.
- `createBooking()` allocation logic: for the booked service, find active
  resources whose `serviceIds` include it, filter by provider eligibility
  (`employeeIds` empty = any provider), filter by location compatibility
  (array intersection; empty on either side = any), then require at least one
  candidate with spare capacity. Capacity is simple: **1 unit per booking**.
- Admin UI: **Recursos** becomes the hub configuration page (three checkbox
  groups + edit/save). **Proveedores** drops its "Recursos elegibles" group.
  **Servicios** drops its "Recurso requerido" selector.

### Deferred (registered, not implemented)

- **Quantity partition** `shared / per-service / per-location`.
- **Group booking** (a single slot consuming/serving multiple people).

Both are recorded in `docs/analysis/amelia-ux-reference.md` ("Decisiones
pendientes" #1 and #4) to revisit if a tenant requires them. Until then,
capacity stays a single integer `quantity` and each booking consumes one unit
of every resource that applies to its service.

## Consequences

- Resources can now be shared across services and span multiple sites; the
  whole resource↔service↔location↔provider relationship is configured in one
  screen, matching the "everything connected and assignable" requirement.
- A single source of truth for eligibility (the resource) removes the model B
  duplication.
- **Canonical layer — additive migration done (2026-06-17).** The hub now also
  exists in the canonical domain/persistence layer as an _additive, non-destructive_
  change that preserves backward compatibility:
  - Domain helpers `packages/domain/src/catalog/resource-hub.ts`
    (`resourceServesService`, `resourceAllowsProvider`,
    `resourceCompatibleWithLocations`, `hubResourcesForBooking`) implement the
    same empty-array "any" semantics as the admin store.
  - SQL migration `infra/postgres/004-resource-hub.sql` adds the resource-owned
    join tables `resource_services`, `resource_locations`, `resource_employees`
    (RLS, idempotent), mirrored in `packages/persistence/src/schema.ts`.
  - Port `ResourceHubRepository` + audited `ResourceHubService`
    (`services/api/src/application/catalog/resource-hub-service.ts`), implemented
    by both the in-memory adapter and `DrizzleResourceHubRepository`.
  - The legacy ADR-0015 shape (`service_resources`, `provider_resources`,
    `resources.location_id`, `ProviderResource`,
    `providerEligibleForResources`) is **retained** and still drives the
    availability engine. Nothing was dropped.
- **Read-model cutover — done (2026-06-17).** `AvailabilityService`, checkout,
  reschedule (`BookingChangeService`), and the Fastify admin routes now read the
  hub. The resources serving a service form an interchangeable pool collapsed into
  one synthetic availability-engine demand (`hub-resources.ts`,
  `HUB_POOL_RESOURCE_ID`): quantity = Σ candidate quantities, allocations = union,
  so `unitsInUse + 1 <= total` expresses "≥1 free unit". The availability engine
  is unchanged (legacy `resources`/`providerEligibleResourceIds` inputs remain and
  are still tested). New Fastify routes: `PUT
/v1/admin/resources/:id/{services,locations,employees}`, `GET
/v1/admin/resources/:id/hub`.
- **Provider locations + legacy drop — done (2026-06-17).** `provider_locations`
  (`005-provider-locations.sql`) gives the canonical `Provider` real locations, fed
  into `hubCandidates` by availability/checkout/reschedule, so hub location
  compatibility is now enforced (empty on either side = "any"). The legacy model-B
  tables `provider_resources` and `service_resources` were dropped
  (`006-drop-legacy-resource-model.sql`) along with all their plumbing
  (`ServiceResource`/`ProviderResource`/`providerEligibleForResources`, the
  `CatalogRepository` model-B methods, and the `POST /v1/admin/services/:id/resources`
  route). The hub is now the sole resource model.
- **`resources.location_id` dropped (2026-06-17):** the ADR-0015 model C single-site
  column was removed (`007-drop-resource-location-id.sql`) from the DB, the domain
  `Resource`, and the Drizzle schema. Multi-site placement lives entirely in
  `resource_locations`. The hub is now the complete and sole resource model with no
  legacy remnants.
- The "4 therapists / 2 rooms" capacity guarantee is preserved: the allocation
  step still rejects a booking when no eligible, location-compatible resource
  has a free unit over the interval.
