# ADR-0023: Tenant Settings Persist On The Tenant Registry, Not A Separate Table

**Date**: 2026-06-26
**Status**: accepted
**Deciders**: Project owner (javier@ikarum.com) + agent

## Context

ADR-0021 decision #4 resolved that booking time policies (cancellation, reschedule, lead time) and
the tenant's **currency** live globally per tenant, "persisted in a new `tenant_settings` record".
Feature 003 (`tenant-settings`) implements the editable settings surface over those values.

When implementing, the existing schema already told a different story: the `tenants` registry row
(`packages/persistence/src/schema.ts`, `infra/postgres/002-domain.sql`) already co-locates
`display_name`, `default_timezone`, `default_locale`, `branding` (jsonb), and `policies` (jsonb). The
tenant aggregate (`packages/domain/src/tenancy/tenant.ts`) already carries all of these. The *only*
settings field missing from persistence was `currency`.

## Decision

Persist tenant settings by **extending the existing `tenants` registry**, not by introducing a
separate `tenant_settings` table:

- Add a single `currency` column to `tenants` (migration `011-tenant-currency.sql`,
  `NOT NULL DEFAULT 'EUR'` to backfill existing rows).
- Keep `display_name`, `default_timezone`, `default_locale`, `branding`, and `policies` where they
  already are (on `tenants`).
- The editable settings surface (`GET`/`PATCH /v1/admin/settings`) reads and writes this single row.

This is a deliberate **deviation from ADR-0021 #4's wording** ("a new `tenant_settings` record"),
while honoring its **intent**: a single global per-tenant configuration point.

## Rationale

- The `tenants` registry row already *is* the per-tenant configuration record. Adding one column
  keeps the tenant aggregate in **one row** — one read, no join, no two-write consistency window.
- It is consistent with how `branding`/`policies` are already stored (jsonb on `tenants`).
- It avoids a data migration that would move existing columns into a new table for no functional gain
  before the MVP is even deployed.

## Alternatives Considered

- **A dedicated `tenant_settings` table (ADR-0021 #4 literal wording)**: splits one aggregate across
  two tables, adds a join on every settings read and a multi-write on save. Rejected now; the natural
  time to revisit is when **per-location policy/currency overrides** arrive (the documented future
  extension from ADR-0021 #4), where a dedicated override table is the correct shape.
- **Keep currency only per service (status quo)**: leaves the tenant with no default and no single
  configuration point; every new service would re-enter currency. Rejected.

## Consequences

- `currency` is a tenant-level default (ISO-4217). New services inherit it at creation; existing
  services/bookings/payments keep the currency they were created with (**non-retroactive** — they
  already store their own `currency` string, so no historical re-pricing occurs).
- The settings surface is admin-role gated and audited (`tenant.localization-updated`,
  `tenant.policies-updated`, `tenant.branding-updated`).
- When per-location overrides are specified later, this ADR is the revisit point: introduce a
  `location_settings` (or equivalent) override table at that time, leaving the tenant-level defaults
  on `tenants`.
- ADR-0021 #4 should be read together with this ADR: the "new `tenant_settings` record" is realized
  as the existing `tenants` registry row plus the `currency` column.
