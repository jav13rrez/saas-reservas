# ADR-0016: Resource Hub Model — Partial Amelia Alignment

**Status:** Accepted
**Date:** 2026-06-16
**Supersedes:** the eligibility/association direction of ADR-0015 (model B) in the
admin console; ADR-0015's domain/persistence layer is not yet migrated (see Consequences).

## Context

A full sweep of the Amelia Premium admin console (notes in
`docs/analysis/amelia-ux-reference.md`) revealed that Amelia treats the
**Resource** as a configuration *hub*: a single Resource entity declares the
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
- **Scope:** this migration currently lands in the admin console's process-local
  store (`apps/admin/src/server/demo-store.ts`) and its Next.js route handlers.
  The canonical domain/persistence layer from ADR-0015 (`packages/domain`,
  `ProviderResource`, `Resource.locationId`, Drizzle tables, RLS) still carries
  the old shape. A follow-up task must migrate the domain model and write the
  additive SQL migration (`resource_services`, `resource_locations`,
  `resource_employees` join tables, dropping `provider_resources` and
  `service.resource_id`) before the public booking widget and Fastify
  `/v1/admin/*` routes can use the hub model.
- The "4 therapists / 2 rooms" capacity guarantee is preserved: the allocation
  step still rejects a booking when no eligible, location-compatible resource
  has a free unit over the interval.
