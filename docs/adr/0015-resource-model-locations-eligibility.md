# ADR-0015: Resource Model — Locations (Multi-Site) and Provider-Resource Eligibility

**Status:** Accepted
**Date:** 2026-06-16
**Tasks:** T087 (locations + eligibility)
**Supersedes:** extends the resource model in `docs/analysis/resources-model-review.md`

## Context

Resources (rooms, boxes, chairs, machines) are limited physical assets that
constrain throughput independently of staff. The original model
(`docs/analysis/resources-model-review.md`) implemented resources as shared
pools demanded by services (`ServiceResource`), which already enforces the
"4 therapists / 2 rooms" constraint via the availability engine. Two gaps
remained relative to the spec and to real clinic/centre operations:

1. **No provider-resource eligibility.** A service-level pool cannot express
   that a specific provider may only use specific resources (e.g. a therapist
   bound to a particular room), or is excluded from others.
2. **No multi-site (locations).** The spec (US1 "ubicaciones", `Service`,
   `Resource.location_id`, `Resource.scope`) assumes resources and providers
   belong to physical sites. No `Location` entity existed.

The product decision (2026-06-16) was to implement **both** model B (provider
eligibility on top of the service pool) and model C (multi-site locations) to
align 100% with the spec.

## Decision

### Locations (model C)

- New `Location` aggregate: `{ id, tenantId, name, timezone?, address?, status }`.
- `Resource` gains an optional `locationId`; a resource belongs to at most one
  site (`NULL` = single-site / unassigned, backwards compatible).
- Persisted via the additive migration `infra/postgres/003-locations-eligibility.sql`
  and the Drizzle `locations` table; RLS applied like every tenant-owned table.

### Provider-resource eligibility (model B)

- New `ProviderResource` association: `{ tenantId, providerId, resourceId }`.
- **Semantics:** a provider with **no** eligibility rows is _unconstrained_
  (may use any resource — backwards compatible). When rows exist, the provider
  may use **only** the listed resources.
- `providerEligibleForResources(eligibleIds, requiredIds)` in the domain
  encodes the rule. The availability engine accepts
  `providerEligibleResourceIds`: if the queried service demands a resource the
  provider is not eligible for, the provider has **zero** availability for that
  service.
- Wired through `AvailabilityService`, the `CatalogRepository` port
  (`setProviderResources`, `listProviderEligibleResourceIds`), and both the
  in-memory and Drizzle adapters. New `provider_resources` table with RLS.

### Pool semantics are unchanged

The existing capacity rule still holds: a booking is admitted only while
`unitsInUse + unitsRequired <= resourceQuantity` over the occupied interval.
Eligibility _narrows_ which providers can serve; the pool quantity still caps
concurrency.

## Consequences

- Clinics/centres can model both shared pools and dedicated/eligible resources,
  and operate multiple sites — closing the spec gap on "ubicaciones".
- Backwards compatible: tenants with no locations and no eligibility rows behave
  exactly as before.
- The admin console exposes **Ubicaciones** and **Recursos** areas, services
  declare a resource demand, and the booking flow rejects over-capacity
  bookings (verified end to end in the in-memory admin store).
- Deferred: provider eligibility and locations are not yet surfaced in the
  public booking widget or the Fastify `/v1/admin/*` HTTP routes; the engine,
  domain, persistence schema, and admin UI are in place. The provider portal UI
  (eligibility editor) and resource _groups_ (interchangeable pools with
  per-provider subsets) remain future work.
