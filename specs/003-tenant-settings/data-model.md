# Phase 1 Data Model: Tenant Settings

**Date**: 2026-06-26 | **Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This feature **extends the existing `Tenant` aggregate** rather than introducing a new entity. The
only new persisted field is `currency`. The settings surface reads and writes a projection of the
tenant.

## Entity: Tenant (existing, extended)

Source: `packages/domain/src/tenancy/tenant.ts` · Table: `tenants` (`packages/persistence/src/schema.ts`)

| Field | Type | New? | Rules / Validation | Notes |
|-------|------|------|--------------------|-------|
| `id` | uuid | — | PK | identity |
| `slug` | text | — | `^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$` | not editable here |
| `displayName` | text | — | non-empty after trim (FR-004) | editable (Perfil) |
| `status` | `active`/`suspended`/`archived` | — | platform-controlled (feature 002) | not editable here |
| `defaultTimezone` | text | — | valid IANA zone (FR-005) | editable (Localización) |
| `defaultLocale` | text | — | non-empty (FR-006) | editable (Localización) |
| **`currency`** | text | **YES** | ISO-4217 code, uppercase, allowlist (FR-007) | editable (Localización); `DEFAULT_CURRENCY = "EUR"` |
| `branding` | jsonb `TenantBranding` | — | see below (FR-014/FR-015) | editable (Marca) |
| `policies` | jsonb `TenantPolicies` | — | see below (FR-009/FR-010/FR-013) | editable (Políticas) |

### Value object: TenantBranding (existing)

| Field | Type | Rules |
|-------|------|-------|
| `primaryColor` | string | valid hex color, e.g. `#1f6feb` (FR-014) |
| `logoUrl` | string? | optional; empty/cleared is valid; malformed reference rejected (FR-015) |

### Value object: TenantPolicies (existing)

| Field | Type | Rules |
|-------|------|-------|
| `cancellationMinNoticeHours` | number | ≥ 0 (FR-010) |
| `rescheduleMinNoticeHours` | number | ≥ 0 (FR-010) |
| `bookingHorizonDays` | number | ≥ 1 (FR-009/FR-013) |
| `requiresApproval` | boolean | persisted; consumed by the booking flow (FR-011) |

## Settings projection (read/write DTO)

The settings surface groups the editable fields. The API exposes this projection; `slug`/`status`/`id`
are read-only context, never written here.

```text
TenantSettings {
  profile:      { displayName }
  localization: { defaultTimezone, defaultLocale, currency }
  policies:     { cancellationMinNoticeHours, rescheduleMinNoticeHours,
                  bookingHorizonDays, requiresApproval }
  branding:     { primaryColor, logoUrl? }
}
```

A `PATCH` body may contain any subset of the four groups; within a group, any subset of fields. The
merge is applied over the current tenant and validated **once** (`validateTenant`) before persisting
(all-or-nothing, FR-017).

## Validation rules (domain)

- `assertValidTimezone(tz)` — existing; `Intl.DateTimeFormat` probe.
- `assertValidCurrency(code)` — **new**; uppercase 3-letter ISO-4217 within an allowlist.
- `validateTenant(tenant)` — existing; extended to call `assertValidCurrency`. Already enforces
  non-empty `displayName`, valid timezone, `cancellationMinNoticeHours ≥ 0`,
  `rescheduleMinNoticeHours ≥ 0`, `bookingHorizonDays ≥ 1`.
- Hex color validation for `branding.primaryColor` (e.g. `#` + 3/6 hex digits).

## State & lifecycle

Settings have no state machine: each save is a whole-record merge-and-replace (last-write-wins for
v1; optimistic concurrency is a documented follow-up). No new transitions.

## Relationships & non-retroactivity

- **Tenant → Services**: a new service inherits `tenant.currency` at creation. Existing
  `service.currency` values are **not** rewritten on a tenant currency change (D2).
- **Tenant → Bookings/Carts/Payments**: each already stores its own `currency`; unaffected by a
  tenant currency change.
- No foreign keys are added; no join tables.

## Persistence change

- Migration `infra/postgres/011-tenant-currency.sql`:
  `ALTER TABLE tenants ADD COLUMN currency text NOT NULL DEFAULT 'EUR';` (backfills existing rows).
  Idempotent (`ADD COLUMN IF NOT EXISTS`). No RLS change — the `tenants` registry posture is unchanged.
- `schema.ts`: add `currency: text("currency").notNull()` to the `tenants` table.
- `tenant-repository.ts`: map `currency` on read and write.

## Audit events (existing infrastructure)

| Change group | Audit action | Actor |
|--------------|-------------|-------|
| Localization/profile | `tenant.localization-updated` | admin staff |
| Policies | `tenant.policies-updated` (existing) | admin staff |
| Branding | `tenant.branding-updated` (existing) | admin staff |

Each is tenant-scoped and recorded through the existing `EventSink` (constitution V).
