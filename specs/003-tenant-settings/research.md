# Phase 0 Research: Tenant Settings

**Date**: 2026-06-26 | **Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

The spec's open questions were resolved inline (Clarifications, 2026-06-26): admin-only
authorization, non-retroactive currency, and branding scope = color + logo. No `NEEDS CLARIFICATION`
markers remain. This document records the resulting technical decisions, their rationale, and the
alternatives considered.

## D1 — Persistence: extend the `tenants` registry, not a separate `tenant_settings` table

- **Decision**: Add a single `currency` column to the existing `tenants` table (migration
  `011-tenant-currency.sql`, `NOT NULL DEFAULT 'EUR'` to backfill). Display name, time zone, locale,
  branding (jsonb), and policies (jsonb) already live on `tenants`; this completes the settings record
  in place.
- **Rationale**: The `tenants` registry row already *is* the per-tenant configuration record that
  ADR-0021 #4 calls for. Adding one column keeps the aggregate in a single row — one read, no join,
  no two-write consistency window. It is consistent with how branding/policies are already stored.
- **Alternatives considered**:
  - *Separate `tenant_settings` table (ADR-0021 #4 literal wording)*: splits one aggregate across two
    tables, adds a join on every settings read and a multi-write on save, for no MVP benefit.
    Rejected now; the natural place to revisit is when **per-location overrides** arrive (deferred),
    where a dedicated override table is the right shape.
  - *Store currency only per service (status quo)*: leaves the tenant with no default and no single
    configuration point; every new service would re-enter currency. Rejected.
- **Consequence**: A documented deviation from ADR-0021 #4's wording, recorded in **ADR-0023**.

## D2 — Currency model: ISO-4217 tenant default, non-retroactive

- **Decision**: `currency` is an ISO-4217 code on the tenant (`DEFAULT_CURRENCY = "EUR"`), validated
  by `assertValidCurrency`. New services inherit the tenant currency at creation; existing services,
  bookings, carts, and payments keep the `currency` string they were created with.
- **Rationale**: Money is already stored in integer minor units with a per-record `currency` string
  (`service.currency`, `booking.currency`, `payment.currency`). Because each money record already
  carries its own currency, non-retroactivity is automatic — changing the tenant default never
  rewrites historical amounts, avoiding a dangerous bulk re-pricing. This matches the spec's resolved
  clarification.
- **Alternatives considered**:
  - *Retroactively re-stamp all services/bookings on currency change*: risks silently mis-pricing
    confirmed bookings and breaking reconciliation (constitution II). Rejected.
  - *Per-booking multi-currency selection*: out of scope; currency is a tenant-level default, not a
    per-transaction choice for v1. Rejected.
- **Validation**: 3 uppercase ASCII letters constrained to a known ISO-4217 allowlist (at least the
  currencies the product targets: EUR, USD, GBP, plus a maintainable set). A pure 3-letter regex is
  insufficient (accepts `ZZZ`); a full ISO library is unnecessary weight for v1.

## D3 — Authorization: admin-role staff only

- **Decision**: `GET`/`PATCH /v1/admin/settings` require a staff session with role `admin`, under the
  existing `/v1/admin/*` staff-auth gate (ADR-0017). Non-admin staff and customers are rejected.
- **Rationale**: Settings change tenant-wide behavior (policies, currency, branding); this is an
  administrative action, consistent with the split-auth model (ADR-0005) and the existing admin gate.
  The tenant is resolved from the request, so the routes need no `tenantId` param and cannot address
  another tenant.
- **Alternatives considered**:
  - *Allow any staff role*: over-broad; a front-desk staff member should not change currency/policies.
    Rejected.
  - *A new dedicated permission flag*: finer-grained roles are a documented follow-up (ADR-0017);
    role `admin` is sufficient for v1. Rejected for now.

## D4 — One all-or-nothing update vs targeted endpoints

- **Decision**: A single `PATCH /v1/admin/settings` accepts any subset of the four groups (profile,
  localization, policies, branding) and applies them through one `updateSettings` orchestrator with a
  single `validateTenant` call (all-or-nothing). The existing `updateBranding`/`updatePolicies`
  remain for targeted internal use.
- **Rationale**: FR-017 requires all-or-nothing saves. A single merged validation guarantees that a
  bad field anywhere blocks the whole save with no partial write. One endpoint also keeps the UI
  contract simple (one Save → one request).
- **Alternatives considered**:
  - *Four targeted endpoints called in sequence from the UI*: a partial failure mid-sequence leaves
    settings half-applied, violating all-or-nothing. Rejected.

## D5 — Admin console delivery: reuse the data-source seam (ADR-0018)

- **Decision**: Build the Settings screen in `apps/admin` through the existing seam: a
  `source/settings.ts` (demo vs api) behind a Next.js route handler `app/api/settings/route.ts`. The
  demo store gets `getSettings`/`updateSettings`; api mode calls the new admin routes via the existing
  `api-client`.
- **Rationale**: Consistent with every other admin screen (Locations, Services, Customers…); keeps the
  single-command `pnpm dev` demo path working and exercises the persistent API in `api` mode. The
  current "Configuración" is a sign-up wizard, not a settings page (walkthrough finding); this gives
  the tenant a real settings surface while the first-run provisioning wizard stays separate.
- **Alternatives considered**:
  - *Client-side fetch directly to the API*: breaks the server-only seam (tenant Host + staff session
    handling live server-side, ADR-0018). Rejected.

## Resolved unknowns

| Topic | Resolution |
|-------|-----------|
| Table vs columns | Extend `tenants` with a `currency` column (D1, ADR-0023) |
| Currency retroactivity | Non-retroactive; per-record currency already stored (D2) |
| Who can edit | Admin-role staff only (D3) |
| Save atomicity | Single `PATCH` + one merged validation (D4) |
| Branding scope | Primary color + optional logo only (spec clarification) |
| Out of scope | Sender email, gateway activation, per-location overrides, lifecycle states |
