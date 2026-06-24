# Phase 1 Data Model: Plataforma Superadmin

**Date**: 2026-06-24 | **Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Scope: new platform-global identity, a tenant lifecycle status, and a tenant-scoped provider↔staff
link. Reuses existing `tenants`, `staff_accounts`, `providers`, and audit infrastructure.

## Entities

### PlatformOperator (NEW — platform-global, no RLS)

Table `platform_operators`. Parallel to `tenants`/`tenant_domains`: platform-global, **not**
tenant-scoped, **no** `apply_tenant_rls`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid (PK) | |
| `email` | text | **unique** (global); normalized lowercase |
| `password_hash` | text | scrypt, self-describing format `scrypt$N$r$p$salt$hash` (ADR-0017) |
| `display_name` | text | |
| `status` | text | `active` \| `disabled` (default `active`) |
| `created_at` / `updated_at` | timestamptz | |

- **Identity/uniqueness**: email unique platform-wide (no tenant dimension).
- **Role**: single implicit role `platform_operator` for v1; finer roles deferred.
- **Relationships**: none to tenant-owned data; referenced only as an audit actor.

### PlatformSession (NEW — in-memory v1)

Opaque session bound to a `PlatformOperator`, held in `PlatformAuthService` (in-memory map for v1,
mirroring staff sessions; persistent store is a documented follow-up). Delivered as the
`platform_session` HttpOnly+Secure cookie. Distinct namespace from `staff_session` and customer
sessions; the three MUST NOT be interchangeable.

| Field | Type | Notes |
|-------|------|-------|
| token | opaque string | cookie value; server-side lookup only |
| operatorId | uuid | → `platform_operators.id` |
| expiresAt | timestamp | short-lived (≈8h, matching staff); invalidated on logout |

### Tenant (EXISTING — extended)

Add/confirm a lifecycle `status` honored by the tenant resolver.

| Field | Type | Notes |
|-------|------|-------|
| `status` | text | `active` \| `suspended` (resolver already handles inactive/unknown tenants) |

- **State transitions** (platform-operator controlled, audited):
  - `active → suspended`: blocks new staff sign-ins and new public bookings/checkout; preserves all
    data and confirmed future bookings.
  - `suspended → active`: restores full operation.
- Provisioning a new tenant creates it `active`.

### StaffAccount (EXISTING — extended)

Add an optional one-to-one link to a catalog provider.

| Field | Type | Notes |
|-------|------|-------|
| `provider_id` | uuid NULL | FK → `providers.id`; **unique within tenant** `(tenant_id, provider_id)` where not null |

- **Constraints**: optional on both sides; one staff ↔ one provider per tenant; clearing the link or
  removing either record leaves no dangling reference.
- Tenant-scoped; existing RLS on `staff_accounts` applies.

### AuditRecord (EXISTING — reused)

- Tenant-affecting platform actions: written to the affected tenant's audit log; actor = platform
  operator id, flagged as a platform actor.
- Platform-only actions (operator bootstrap, login, logout, operator creation): written via the
  platform/global context.

## Migrations

- `infra/postgres/009-platform-operators.sql` — create `platform_operators` (platform-global, **no**
  `apply_tenant_rls`); unique index on `email`.
- `infra/postgres/010-staff-provider-link.sql` — add nullable `staff_accounts.provider_id`, FK to
  `providers(id)`, partial unique index on `(tenant_id, provider_id)` where `provider_id is not null`.
- Tenant `status`: add/confirm the column + default `active` if not already present (idempotent).

Mirror all schema changes in `packages/persistence/src/schema.ts`.

## Validation Rules (from requirements)

- Platform email unique and normalized (FR-001/FR-002).
- Bootstrap allowed only while zero operators exist and the deploy secret matches (FR-020).
- Suspended tenant rejects new staff sign-ins and new public bookings; data preserved (FR-021).
- Provider↔staff link is optional and one-to-one within a tenant (FR-018/FR-019).
- No platform credential/secret persisted to source control (FR-007/SC-006).
