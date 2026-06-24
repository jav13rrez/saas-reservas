# Phase 1 Quickstart: Plataforma Superadmin

**Date**: 2026-06-24 | **Feature**: [spec.md](./spec.md) | **Contracts**: [contracts/platform-api.md](./contracts/platform-api.md)

Runnable validation scenarios proving the feature end to end. Implementation lives in `tasks.md`
(produced by `/speckit-tasks`); this is a run/validation guide only.

## Prerequisites

- Local stack per `docs/operations/SETUP.md`: PostgreSQL + Redis (`infra/docker-compose.yml`),
  migrations `001`…`010` applied, API in persistent mode (`DATABASE_URL` set).
- `.env`: `PLATFORM_BOOTSTRAP_SECRET` set to a strong value (kept outside source control).
- API base URL, e.g. `http://localhost:3000`.

## Scenario 1 — First-operator bootstrap is gated and self-locking (US1, FR-020)

1. `POST /v1/platform/operators/bootstrap` with the correct `secret` and operator credentials →
   **201**.
2. Repeat the same call → **409** (self-locked; an operator now exists).
3. Call bootstrap with a wrong/missing `secret` (in a fresh DB) → **403**.

**Expected**: exactly one path creates the first operator; the endpoint cannot be used again.

## Scenario 2 — Platform surface is locked without a session (US1, FR-003/FR-004)

1. `GET /v1/ops/tenants` with no cookie → **401**.
2. `POST /v1/platform/tenants` with no cookie → **401**.
3. Sign in as a **tenant** admin (`POST /v1/admin/sessions`) and present that `staff_session` against
   `GET /v1/ops/tenants` → **403** (not interchangeable).
4. `POST /v1/platform/sessions` with operator credentials → **200** + `platform_session` cookie; retry
   step 1 with the cookie → **200**.

**Expected**: cross-tenant data and platform actions are unreachable without a platform session, and a
tenant session is rejected.

## Scenario 3 — Authenticated provisioning + first tenant admin (US2, FR-008/FR-009)

1. As an authenticated operator: `POST /v1/platform/tenants` → **201** (tenant created).
2. `POST /v1/platform/tenants/:id/staff` → **201** (first tenant admin bootstrapped).
3. The new admin signs in via `POST /v1/admin/sessions` → **200**.
4. Inspect the audit trail: `tenant.provisioned` and `tenant.admin.bootstrapped` recorded with the
   operator as actor.

## Scenario 4 — Tenant suspension semantics (US2, FR-021)

1. Create a tenant with a service/provider/schedule and one confirmed future booking.
2. `PATCH /v1/platform/tenants/:id` `{ "status": "suspended" }` → **200**.
3. The tenant's staff sign-in (`POST /v1/admin/sessions`) → rejected; a new `POST /v1/public/checkout`
   → rejected.
4. Confirm the existing future booking still exists and tenant data is intact.
5. `PATCH … { "status": "active" }` → **200**; staff sign-in and public booking work again.

**Expected**: suspension blocks new logins + new bookings only; nothing is destroyed; reversible.

## Scenario 5 — Operations overview on the platform surface (US3, FR-012/FR-014/FR-015)

1. As an operator, open `apps/platform` operations dashboard → all tenants with billing status,
   usage/quota bars, and per-tenant audit activity.
2. Confirm `apps/admin` no longer exposes the operations view.
3. Confirm the dashboard uses design tokens, Lucide icons, Spanish strings, no emojis (ADR-0008).
4. Confirm cross-tenant data is read via the platform/global path (no tenant context can read another
   tenant's rows — covered by the RLS isolation integration test).

## Scenario 6 — Provider ↔ staff link (US4, FR-016–FR-019)

1. As a tenant admin: `PATCH /v1/admin/staff/:id` `{ "providerId": "<provider>" }` → **200**.
2. Attempt to link the same provider to a second staff account → **409** (one-to-one).
3. `PATCH /v1/admin/staff/:id` `{ "providerId": null }` → **200** (unlinked); both records still exist.

## Acceptance status

| Scenario | Spec mapping | Status |
|----------|--------------|--------|
| 1 Bootstrap gated/self-locking | US1 / FR-020 | Validated 2026-06-24 (in-memory API, curl: 403 -> 201 -> 409 -> 409) |
| 2 Platform surface locked | US1 / FR-003, FR-004 | Validated 2026-06-24 (in-memory API, curl: 401/401 -> login 200 -> ops 200 -> staff_session 403 -> logout 204 -> 401) |
| 3 Authenticated provisioning | US2 / FR-008, FR-009 | Pending implementation |
| 4 Suspension semantics | US2 / FR-010, FR-021 | Pending implementation |
| 5 Operations overview | US3 / FR-012–FR-015 | Pending implementation |
| 6 Provider↔staff link | US4 / FR-016–FR-019 | Pending implementation |
