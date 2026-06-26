# Implementation Plan: Tenant Settings

**Branch**: `003-tenant-settings` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-tenant-settings/spec.md`

## Summary

Deliver a real **tenant settings surface** so a tenant administrator can edit, after onboarding, the
values the tenant aggregate already carries — display name, time zone, locale, booking policies, and
branding — plus a new **currency** field (ADR-0021 #4). Today these are set only at provisioning and
there is no settings page; two application methods that already exist (`updateBranding`,
`updatePolicies` on `TenantAdminService`) are **orphaned** (no route calls them). This feature wires
them up, adds localization/profile editing and currency, exposes an admin-gated settings API, and
builds the admin console Settings screen through the existing data-source seam (ADR-0018) in both
`demo` and `api` modes.

Technical approach: **extend the existing `tenants` registry** with a `currency` column rather than
introduce a separate `tenant_settings` table (the registry already co-locates branding/policies/
timezone/locale; a separate table would split one aggregate for no MVP benefit — recorded as
ADR-0023). Add `currency` to the domain `Tenant` with ISO-4217 validation and a default; add a
`updateLocalization` method and a single all-or-nothing `updateSettings` orchestrator to
`TenantAdminService`; expose `GET /v1/admin/settings` and `PATCH /v1/admin/settings` behind the
existing staff-auth admin gate (the tenant is the request-resolved tenant, so isolation is
structural — no `tenantId` in the path). Currency is **non-retroactive**: services/bookings/payments
already store their own currency string, so existing money records are untouched; only new services
inherit the tenant's new currency at creation.

## Technical Context

**Language/Version**: TypeScript 5.x (shared across API, apps, packages) — unchanged.

**Primary Dependencies**: Fastify (API, ADR-0002), Next.js App Router (`apps/admin`, ADR-0001),
Drizzle + SQL migrations (persistence, ADR-0003), `packages/ui` design tokens + `lucide-react`
(ADR-0008). No new third-party dependency. ISO-4217 / IANA / hex-color validation use small local
checks (`Intl` for time zone is already used in `assertValidTimezone`).

**Storage**: PostgreSQL. **One additive migration** `011-tenant-currency.sql`: add
`tenants.currency text NOT NULL DEFAULT 'EUR'` (backfills existing rows). No new table, no RLS change
(the `tenants` registry posture is unchanged). Branding/policies remain the existing jsonb columns;
timezone/locale/display name remain existing columns.

**Testing**: Unit (ISO-4217 currency validation; tenant validation with currency; localization merge;
all-or-nothing settings update). Integration (settings read returns current values; PATCH persists +
audits each changed group; invalid input rejected with no partial write; **currency change leaves an
existing service's stored currency unchanged**; cross-tenant isolation — tenant A's settings
unreachable under tenant B's context). E2E over HTTP (admin settings GET → PATCH → GET reflects;
non-admin staff/customer rejected; booking-horizon change reflected by availability). Drizzle/RLS
suites self-skip without PostgreSQL, per existing convention.

**Target Platform**: Linux cloud runtime; the settings surface is part of the existing `apps/admin`
console and the existing Fastify API. No new app or service.

**Project Type**: Modular monolith — no new delivery surface; one new admin-gated route pair and one
admin console feature.

**Performance Goals**: Settings read/write are single-row operations off the hot path; no booking-
latency impact. Settings GET p95 < 200 ms.

**Constraints**: Admin-role only (constitution Security & Privacy; ADR-0017); every change audited
(constitution V); all-or-nothing validation; tenant isolation — settings only ever affect the
request-resolved tenant (constitution I). Currency is non-retroactive.

**Scale/Scope**: One settings record per tenant; 100–500 tenants (design target inherited from
feature 001).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Tenant Isolation Is Non-Negotiable** — PASS. Settings read/write target only the
  request-resolved tenant (no `tenantId` in the path); persistence stays within the tenant's own
  registry row. The `tenants` registry posture is unchanged; no cross-tenant read is introduced.
- **II. Booking Correctness Beats Interface Convenience** — PASS. This feature only relocates the
  *configuration point* of policies/horizon that the availability engine and change/cancel policy
  engine already consume; it does not alter those engines. Currency is non-retroactive, so no
  existing priced booking changes.
- **III. Domain Engine Before Delivery Channels** — PASS. Currency validation, tenant validation, and
  the settings merge live in `packages/domain` + `TenantAdminService` (application), testable without
  HTTP; the Fastify routes and the admin Settings screen are delivery channels.
- **IV. Enterprise Integrations Are Isolated Adapters** — PASS (n/a; no external integration; sender
  email / gateway activation are explicitly out of scope).
- **V. Operational Workflows Are Eventful And Auditable** — PASS. Each settings change (localization,
  policies, branding) emits a domain event + audit record with the admin as actor, reusing the
  existing event-sink infrastructure (the orphaned `updateBranding`/`updatePolicies` already do this).
- **VI. Configurable Vertical Core** — PASS. Settings are tenant configuration expressed as data, the
  principle's intent.

No violations. The one notable choice (extend `tenants` vs new table) is recorded in Complexity
Tracking and ADR-0023.

## Architecture Decisions

### 1. Persistence: extend the `tenants` registry, not a separate `tenant_settings` table

ADR-0021 #4 names "a new `tenant_settings` record" as the global configuration point. In practice the
existing `tenants` registry row **already is** that record: it holds `display_name`,
`default_timezone`, `default_locale`, `branding` (jsonb), and `policies` (jsonb). The only missing
field is `currency`.

**Decision**: add a single `currency` column to `tenants` (migration `011-tenant-currency.sql`,
default `'EUR'` to backfill). Reasons: keeps the tenant aggregate in one row (no join, no two-write
consistency problem), matches how branding/policies are already stored, and satisfies ADR-0021 #4's
*intent* (one global per-tenant configuration point). A separate table is reconsidered only if/when
per-location overrides arrive (the documented future extension), at which point a dedicated
`location_settings`/override table is the natural shape. **This deviation from ADR-0021 #4's wording
is recorded in ADR-0023.**

### 2. Domain: currency on the Tenant aggregate

- Add `currency: string` to `Tenant` (ISO-4217, e.g. `"EUR"`), `DEFAULT_CURRENCY = "EUR"`, and
  `assertValidCurrency` (validate against a known ISO-4217 set or a strict 3-uppercase-letter +
  allowlist check) called from `validateTenant`.
- New services inherit the tenant's currency at creation (the catalog create path reads the tenant
  default); **existing** services/bookings/payments keep their stored `currency` string untouched
  (non-retroactive is automatic because money records already carry their own currency).

### 3. Application: TenantAdminService gains localization + an all-or-nothing settings update

- Add `updateLocalization({ tenantId, displayName?, defaultTimezone?, defaultLocale?, currency?,
  actor })` mirroring the existing `updateBranding`/`updatePolicies` (merge → `validateTenant` →
  persist → audit `tenant.localization-updated`).
- Add `updateSettings({ tenantId, profile?, localization?, policies?, branding?, actor })` that
  applies any provided subset in **one** merge and a single `validateTenant` call (all-or-nothing
  per FR-017), emitting one audit record per changed group. The existing `updateBranding`/
  `updatePolicies` stay for targeted use; `updateSettings` is the orchestrator the route calls.
- Add `getSettings(tenantId)` returning the tenant's settings projection.

### 4. API: admin-gated settings routes (request-resolved tenant)

- `GET /v1/admin/settings` → the resolved tenant's settings (profile, localization, currency,
  policies, branding).
- `PATCH /v1/admin/settings` → partial update accepting any subset of the four groups; one Save in
  the UI maps to one request; all-or-nothing validation; 200 on success, 400 on validation failure
  (no partial write), 401/403 without an admin session.
- Both routes live under the existing `/v1/admin/*` staff-auth gate and require **role `admin`**
  (settings are an admin action; non-admin staff and customers are rejected — FR-002). The tenant is
  the one resolved from the request (`X-Forwarded-Host`/Host, ADR-0018), so there is **no `tenantId`
  in the path** and isolation is structural. Wired as an optional `tenantSettings` dep in `buildApp`
  and into both `main.ts` bootstraps, matching the existing pattern.

### 5. Admin console: Settings feature through the data-source seam (ADR-0018)

- New `apps/admin/src/features/settings` screen (design tokens, Lucide icons, Spanish, no emojis):
  grouped sections Perfil / Localización / Políticas de reserva / Marca, with one Save per section or
  a single Save — a single Save mapping to one `PATCH /v1/admin/settings` is preferred for
  all-or-nothing semantics.
- New seam module `src/server/source/settings.ts` (demo vs api) + Next.js route handler
  `app/api/settings/route.ts` (GET/PATCH). The **demo store** gains `getSettings`/`updateSettings`
  over its in-memory tenant; the **api** path calls the new admin routes through the existing
  `api-client`. This replaces the wizard-style "Configuración" with a real settings page; the
  provisioning wizard (first-run alta) stays where it belongs.

### 6. Authorization & audit

- Reuse staff-auth (ADR-0017); require an admin session with role `admin`. Each changed group emits
  the existing audit events (`tenant.branding-updated`, `tenant.policies-updated`,
  `tenant.localization-updated`) with the admin as actor, tenant-scoped.

## Project Structure

### Documentation (this feature)

```text
specs/003-tenant-settings/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output (currency model, non-retroactivity, table-vs-columns)
├── data-model.md        # Phase 1 output (Tenant + currency; settings projection)
├── quickstart.md        # Phase 1 output (admin settings round-trip scenarios)
├── contracts/           # Phase 1 output (GET/PATCH /v1/admin/settings)
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (affected/added)

```text
packages/
├── domain/src/tenancy/tenant.ts        # add currency + DEFAULT_CURRENCY + assertValidCurrency
└── persistence/src/schema.ts           # add tenants.currency column

services/api/src/
├── application/tenancy/tenant-admin-service.ts  # updateLocalization + updateSettings + getSettings
├── api/
│   ├── admin-settings-routes.ts        # NEW: GET/PATCH /v1/admin/settings (admin-role gated)
│   └── availability-routes.ts          # register settings routes under the admin gate
└── main.ts                             # wire tenantSettings dep in both bootstraps

packages/persistence/src/repositories/tenant-repository.ts  # map the new currency column

apps/admin/src/
├── features/settings/                  # NEW Settings screen (Perfil/Localización/Políticas/Marca)
├── server/source/settings.ts           # NEW seam (demo vs api)
├── server/demo-store.ts                # demo getSettings/updateSettings
└── app/api/settings/route.ts           # NEW Next.js GET/PATCH handler

infra/postgres/
└── 011-tenant-currency.sql             # NEW: ALTER TABLE tenants ADD COLUMN currency (default 'EUR')

docs/adr/
└── 0023-tenant-settings-persistence.md # NEW: extend tenants registry vs separate tenant_settings
```

**Structure Decision**: No new app or service. The settings surface is part of the existing
`apps/admin` console and the existing Fastify API. The new route pair sits in the already-isolated
`/v1/admin/*` group (request-resolved tenant, structural isolation). The new column extends the
existing tenant aggregate rather than creating a parallel table, keeping reads single-row.

## Test Plan

| Level | Cases | Runs against |
|-------|-------|--------------|
| Unit | `assertValidCurrency` accept (EUR/USD/GBP) + reject (lowercase, 2-letter, unknown); `validateTenant` with currency; localization/settings merge; all-or-nothing (one invalid field ⇒ no change) | always |
| Integration | settings read returns current; PATCH persists + audits each group; invalid (bad tz, non-ISO currency, negative notice, horizon < 1, blank name, bad color) rejected with no partial write; **currency change leaves an existing service's `currency` unchanged**; cross-tenant isolation | in-memory always; Drizzle/RLS self-skips without PostgreSQL |
| E2E (HTTP) | admin GET → PATCH → GET reflects new values; non-admin staff session and customer session rejected (401/403); booking-horizon change reflected by `GET /v1/public/availability` | always (in-memory app) |

## Complexity Tracking

| Decision / Added Complexity | Why Needed | Simpler/Alternative Rejected Because |
|------------------------------|------------|--------------------------------------|
| Extend `tenants` with a `currency` column instead of a new `tenant_settings` table (deviates from ADR-0021 #4 wording) | The registry row already co-locates branding/policies/timezone/locale; adding one column keeps the aggregate in one row and one read | A separate table splits one aggregate, adds a join + two-write consistency, for zero MVP benefit; revisit only when per-location overrides arrive |
| New `updateSettings` orchestrator alongside the existing `updateBranding`/`updatePolicies` | One Save = one all-or-nothing request (FR-017) over a single merged validation | Calling the three targeted methods from the route would make a multi-write partial-failure possible, violating all-or-nothing |
| Single `PATCH /v1/admin/settings` (no `tenantId` in path) | Tenant is request-resolved; structural isolation (constitution I) and a simpler UI contract | A `:tenantId` path param would invite cross-tenant addressing the admin gate would then have to re-check |
