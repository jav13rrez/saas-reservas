# ADR-0017: Staff Authentication Implementation

**Date**: 2026-06-17
**Status**: accepted
**Deciders**: Project owner + agent
**Refines**: ADR-0005 (split staff/customer auth)

## Context

ADR-0005 decided the staff auth model (tenant-scoped email + password, opaque
server-side sessions in an HttpOnly cookie, distinct from customer passwordless).
`/v1/admin/*` had been running with a `SYSTEM_ACTOR` placeholder and was
documented as development-only. This ADR records the concrete implementation and
two pragmatic deviations.

## Decision

- **Password hashing uses Node's built-in `scrypt`** (memory-hard KDF), not
  argon2id as ADR-0005's prose suggested. argon2 requires a native build
  (node-gyp) which the execution environment restricts. scrypt is a standard,
  memory-hard KDF available in `node:crypto` with no native dependency. The
  stored format is self-describing (`scrypt$N$r$p$salt$hash`) so parameters can
  evolve, and verification is constant-time. A follow-up ADR may switch to
  argon2id once native builds are available.
- **Staff accounts are durable** (`staff_accounts` table, RLS, unique
  `(tenant_id, email)`), behind a `StaffAccountStore` port with in-memory and
  Drizzle adapters. **Sessions are held in memory** in `StaffAuthService`,
  mirroring the existing customer passwordless service; a persistent session
  store can replace the map without touching callers. (ADR-0005 envisioned
  PostgreSQL sessions; deferring that keeps parity with the customer side and is
  a localized change later.)
- **Roles:** `admin` (manage tenant catalog/config — gates `/v1/admin/*`) and
  `staff` (operational, narrower). The `/v1/admin/*` gate requires an `admin`
  session; non-admin sessions get 403.
- **Wiring is opt-in:** `buildApp` takes an optional `staffAuth`. When provided,
  the gate is active and login/logout/bootstrap routes are exposed; when omitted,
  `/v1/admin/*` stays open. Production (`main.ts`) provides it; fast in-memory
  tests that exercise other concerns opt out, keeping them unchanged. The audit
  actor for admin mutations is the authenticated staff member (else `system`).
- **Routes:** `POST /v1/admin/sessions` (login → `staff_session` cookie),
  `DELETE /v1/admin/sessions` (logout), `POST /v1/admin/staff` (admin provisions
  more staff), and `POST /v1/platform/tenants/:tenantId/staff` (platform operator
  bootstraps the first admin — platform-operator auth itself is out of scope).

## Consequences

- `/v1/admin/*` can be exposed in production behind real staff auth.
- Failed logins verify against a placeholder hash to keep timing uniform
  (no user-enumeration via response time).
- Negative: we own session lifecycle; the in-memory session map is per-process
  (fine for a single-node dev/prod-preview; a shared store is needed before
  horizontal scaling). Recorded as follow-up.
- Follow-up: persistent/shared session store; rate limiting on login; optional
  switch to argon2id; MFA (already noted in ADR-0005).
