# Phase 1 API Contracts: Plataforma Superadmin

**Date**: 2026-06-24 | **Feature**: [spec.md](./spec.md)

All endpoints live on the existing Fastify API. The `/v1/platform/*` and `/v1/ops/*` groups are
exempt from Host-based tenant resolution and (with this feature) gated by a platform session — except
the self-locking bootstrap. Tenant-scoped endpoints stay under the existing staff-auth gate.

## Platform authentication & operators (platform-global)

### POST /v1/platform/operators/bootstrap  — first operator only

- **Auth**: none (self-locking). Requires header/body secret matching env `PLATFORM_BOOTSTRAP_SECRET`.
- **Body**: `{ "secret": string, "email": string, "password": string, "displayName": string }`
- **201**: `{ "id": string, "email": string }` — created the first operator.
- **403**: secret missing/invalid.
- **409**: at least one operator already exists (self-locked) — regardless of secret.
- **Audit**: platform-global `platform.operator.bootstrapped`.

### POST /v1/platform/sessions  — login

- **Auth**: none. **Body**: `{ "email": string, "password": string }`.
- **200**: sets `platform_session` HttpOnly+Secure cookie; body `{ "operatorId": string }`.
- **401**: invalid credentials (generic; no account-existence disclosure; constant-time).
- **Audit**: `platform.operator.login` (success and failure).

### DELETE /v1/platform/sessions  — logout

- **Auth**: platform session. **200**: clears the cookie. **Audit**: `platform.operator.logout`.

### POST /v1/platform/operators  — create another operator

- **Auth**: platform session. **Body**: `{ "email", "password", "displayName" }`.
- **201**: `{ "id", "email" }`. **409**: email already exists. **Audit**: `platform.operator.created`.

## Tenant provisioning & lifecycle (platform-gated)

### POST /v1/platform/tenants  — provision tenant  *(existing route; now gated)*

- **Auth**: platform session (was: none — the gap this feature closes).
- **Body/response**: unchanged in shape. **Audit**: `tenant.provisioned` (actor = platform operator).

### POST /v1/platform/tenants/:tenantId/staff  — bootstrap first tenant admin  *(existing; now gated)*

- **Auth**: platform session. **Audit**: `tenant.admin.bootstrapped` (actor = platform operator).

### PATCH /v1/platform/tenants/:tenantId  — lifecycle  *(NEW)*

- **Auth**: platform session. **Body**: `{ "status": "active" | "suspended" }`.
- **200**: `{ "id", "status" }`. **Audit**: `tenant.suspended` / `tenant.reactivated`.
- **Effect**: `suspended` blocks new tenant staff sign-ins and new public bookings/checkout; data and
  confirmed future bookings preserved; reversible.

## Operations feed (platform-gated, read)

### GET /v1/ops/tenants  — cross-tenant overview  *(existing route; now gated)*

- **Auth**: platform session (was: none). Returns per-tenant billing status, usage/quotas
  (bookings/storage/notifications), and recent audit activity. Reads via the platform/global path;
  no tenant RLS context is widened.

## Access control invariants (apply to all of the above)

- No valid platform session → `401` on every gated platform/ops endpoint (FR-003).
- A `staff_session` or customer session presented at a platform endpoint → `403` (FR-004); sessions
  are not interchangeable.

## Tenant-scoped: provider ↔ staff link (existing staff-auth gate)

### PATCH /v1/admin/staff/:staffId  — set/clear provider link  *(NEW)*

- **Auth**: tenant admin session (`staff_session`, role admin). Tenant-scoped (RLS).
- **Body**: `{ "providerId": string | null }`.
- **200**: `{ "id", "providerId": string | null }`.
- **409**: provider already linked to another staff account in the tenant (one-to-one).
- **404**: staff or provider not found in tenant.
- **Audit**: `staff.provider.linked` / `staff.provider.unlinked`.
