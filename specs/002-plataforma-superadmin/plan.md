# Implementation Plan: Plataforma Superadmin

**Branch**: `002-plataforma-superadmin` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-plataforma-superadmin/spec.md`

## Summary

Introduce a **platform-global superadmin identity and an authenticated platform surface**, separate
from the per-tenant admin console, that closes the project's largest security gap: today the
cross-tenant operations view lives unprotected inside `apps/admin` and the tenant provisioning
endpoints (`POST /v1/platform/tenants`, `POST /v1/platform/tenants/:id/staff`) accept unauthenticated
requests.

Technical approach: add a platform-global `platform_operators` table (no tenant scope, no RLS — like
`tenants`/`tenant_domains`), a `PlatformAuthService` that mirrors the staff-auth pattern (ADR-0017;
scrypt password hashing, opaque server-side session in an HttpOnly `platform_session` cookie), and a
platform-auth gate that protects the already-tenant-resolution-exempt `/v1/platform/*` and `/v1/ops/*`
route groups. A deployment-secret-gated, self-locking bootstrap creates the first operator. Tenant
lifecycle (active/suspended) becomes a platform-operator action whose suspended state is enforced at
staff sign-in and public booking. The existing operations dashboard moves out of `apps/admin` into a
new thin `apps/platform` Next.js surface aligned to the design system (ADR-0008). Separately and
tenant-scoped, a staff account gains an optional one-to-one link to a catalog provider.

## Technical Context

**Language/Version**: TypeScript 5.x (shared across API, workers, apps, packages) — unchanged.

**Primary Dependencies**: Fastify (API, ADR-0002), Next.js App Router (apps, ADR-0001), Drizzle +
SQL migrations (persistence, ADR-0003), `node:crypto` scrypt for password hashing (ADR-0017),
`packages/ui` design tokens + `lucide-react` (ADR-0008). No new third-party dependency required.

**Storage**: PostgreSQL. New **platform-global** table `platform_operators` (no RLS, like `tenants`).
New tenant-scoped nullable column `staff_accounts.provider_id` (RLS already applies). Tenant
lifecycle status reuses/extends the existing `tenants` status the resolver already honors.

**Testing**: Unit (bootstrap self-lock rule, suspension policy decision, password reuse); integration
(platform-auth gate rejects unauthenticated `/v1/ops` + `/v1/platform`; suspended tenant blocks staff
login and public booking while preserving data; provider↔staff one-to-one constraint; platform audit
isolation); e2e over HTTP (bootstrap → login → provision tenant → bootstrap tenant admin → suspend →
reactivate; tenant admin/staff session rejected at platform surface). Drizzle/RLS suites self-skip
without PostgreSQL, per existing convention.

**Target Platform**: Linux cloud runtime; the platform surface is a distinct app/origin behind the
same reverse proxy. The proxy MUST strip inbound `X-Forwarded-Host` (existing requirement, ADR-0018).

**Project Type**: Modular monolith — adds one delivery surface (`apps/platform`) over the existing
Fastify API; no new service.

**Performance Goals**: Platform sign-in p95 < 300 ms (excluding KDF cost); operations overview loads
all tenants for the platform owner within normal dashboard expectations (< 2 s for the design target
of 100–500 tenants). No hot-path/booking-latency impact.

**Constraints**: Platform identity MUST be platform-global and never interchangeable with tenant
staff/customer sessions; cross-tenant aggregation is a platform privilege via the global context, never
a widened tenant RLS context; every platform action is audited; no credential/secret in source control.

**Scale/Scope**: One platform owner initially, a small number of operators; 100–500 tenants (design
target inherited from feature 001).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Tenant Isolation Is Non-Negotiable** — PASS. `platform_operators` and platform sessions are
  *explicitly platform-global* (the principle's stated exception), parallel to `tenants`/`tenant_domains`;
  they carry no tenant data. The cross-tenant operations overview reads per-tenant data through the
  platform/global path and MUST NOT widen one tenant's `app.current_tenant_id` to read another's.
  The provider↔staff link is tenant-scoped and inherits RLS on `staff_accounts`.
- **II. Booking Correctness Beats Interface Convenience** — PASS (n/a to the booking engine). Tenant
  suspension only *adds* a precondition (reject new bookings/logins for suspended tenants); it never
  relaxes availability/payment validation and does not touch confirmed bookings.
- **III. Domain Engine Before Delivery Channels** — PASS. Auth/session logic, the bootstrap self-lock
  rule, and the suspension decision live in application/domain modules and are testable without HTTP;
  `apps/platform` and Fastify routes are delivery channels.
- **IV. Enterprise Integrations Are Isolated Adapters** — PASS (n/a; no external integration added).
  Platform credentials are hashed at rest; the bootstrap secret is environment configuration.
- **V. Operational Workflows Are Eventful And Auditable** — PASS. Operator sign-in/out, first-operator
  bootstrap, tenant provisioning, first-admin bootstrap, tenant lifecycle changes, and provider↔staff
  linking each emit an audit record with the acting identity as actor.
- **VI. Configurable Vertical Core** — PASS (n/a; no vertical behavior added).

No violations. Complexity Tracking records the one notable structural choice (separate app).

## Architecture Decisions

### Platform identity (platform-global)

- New table **`platform_operators`** (platform-global, **no RLS**, like `tenants`): `id`, `email`
  (unique), `password_hash` (scrypt, self-describing format per ADR-0017), `display_name`, `status`
  (`active`/`disabled`), timestamps. Single role for v1 (`platform_operator`); finer platform roles
  deferred.
- **`PlatformAuthService`** (`services/api/src/application/identity/`), parallel to `StaffAuthService`:
  `authenticate` → opaque `platform_session` HttpOnly+Secure cookie (in-memory session map for v1,
  matching ADR-0017's staff-session parity; shared/persistent store is the same documented follow-up),
  `getSession`, `logout`. Failed logins verify against a placeholder hash for uniform timing and are
  audited. Platform sessions are a *distinct cookie and namespace* from `staff_session` and customer
  sessions; the three are not interchangeable (constitution Security & Privacy; ADR-0005).

### First-operator bootstrap (FR-020)

- `POST /v1/platform/operators/bootstrap` is gated by env `PLATFORM_BOOTSTRAP_SECRET` (compared in
  constant time) **and self-locks**: it succeeds only while zero operators exist; once one exists it
  returns a conflict regardless of secret. The secret and resulting credentials live outside source
  control (env / operator-held). Recorded in an ADR.

### Platform-auth gate

- `buildApp` gains an optional `platformAuth` dep. When provided, all `/v1/platform/*` (except the
  self-locking bootstrap) and `/v1/ops/*` routes require a valid platform session (401/403). These
  groups are already exempt from tenant resolution (`availability-routes.ts`), so the gate slots in
  cleanly. `main.ts` wires it in both bootstraps; fast in-memory tests opt out, as with staff auth.
- Routes: `POST /v1/platform/sessions` (login), `DELETE /v1/platform/sessions` (logout),
  `POST /v1/platform/operators` (create more operators — requires a platform session). The existing
  `POST /v1/platform/tenants` and `POST /v1/platform/tenants/:id/staff` move behind the gate unchanged
  in shape.

### Tenant lifecycle & suspension (FR-010, FR-021)

- `PATCH /v1/platform/tenants/:id` sets lifecycle `status` (`active`/`suspended`), audited. Suspension
  is enforced where tenant access is evaluated: the **tenant resolver** rejects a suspended tenant for
  tenant staff sign-in and for public booking/checkout; existing data and already-confirmed future
  bookings are untouched; reactivation restores full operation. The suspension decision is a pure
  function in the application layer.

### Cross-tenant operations surface

- The operations overview (billing status, usage/quota bars, per-tenant audit) **moves from**
  `apps/admin/src/features/operations` **into a new `apps/platform`** Next.js app, gated by the
  platform session, and is **realigned to the design system** (design tokens + `lucide-react` +
  Spanish strings + no emojis), fixing the current Tailwind/English deviation (ADR-0008). It consumes
  the existing `/v1/ops/tenants` feed (now authenticated) plus the audit API. Cross-tenant reads use
  the platform/global persistence path; no tenant RLS context is widened.

### Provider ↔ staff link (tenant-scoped; FR-016–FR-019)

- Add nullable `staff_accounts.provider_id` (FK → `providers.id`, **unique within tenant**), enforcing
  one-to-one. Both sides remain optional and independently deletable; removing either clears the link
  (no dangling reference). Managed by the tenant admin via a new route under the existing staff-auth
  gate (e.g. `PATCH /v1/admin/staff/:id` to set/clear `providerId`). Tenant-scoped, RLS already applies.

### Audit

- Tenant-affecting platform actions (provisioning, first-admin bootstrap, lifecycle change) are audited
  in the affected tenant's audit log with the platform operator as actor (distinguishable as a platform
  actor). Platform-only actions (operator bootstrap, login, logout, operator creation) are audited via
  the platform/global context. Reuses the existing event-sink/audit infrastructure.

## Project Structure

### Documentation (this feature)

```text
specs/002-plataforma-superadmin/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (platform + admin-link API contracts)
└── checklists/
    └── requirements.md  # Spec quality checklist (from /speckit-specify)
```

### Source Code (affected/added)

```text
apps/
├── admin/                      # operations feature REMOVED from here
│   └── src/features/operations # → deleted/moved to apps/platform
└── platform/                   # NEW thin Next.js surface (login + operations + provisioning)
    └── src/
        ├── app/                # login, dashboard, tenant provisioning, lifecycle
        └── features/operations # moved + design-system-aligned

services/api/src/
├── api/
│   ├── availability-routes.ts  # platform-auth gate on /v1/platform/* and /v1/ops/*
│   └── platform-routes.ts      # NEW: operator bootstrap/sessions/create; tenant lifecycle PATCH
├── application/
│   └── identity/
│       └── platform-auth-service.ts   # NEW (parallels staff-auth-service.ts)
└── main.ts                     # wire platformAuth in both bootstraps + PLATFORM_BOOTSTRAP_SECRET

packages/
├── persistence/src/schema.ts   # platform_operators table; staff_accounts.provider_id
├── domain/                      # suspension decision + bootstrap self-lock rule (pure)
└── contracts/src/environment.ts# add PLATFORM_BOOTSTRAP_SECRET (optional, validated when present)

infra/postgres/
├── 009-platform-operators.sql  # NEW platform-global table (no RLS)
└── 010-staff-provider-link.sql # NEW nullable staff_accounts.provider_id + unique(tenant_id, provider_id)
```

**Structure Decision**: Keep the modular monolith and the single Fastify API. Add **one new delivery
surface** (`apps/platform`) rather than a gated route group inside `apps/admin`, so that "the platform
surface is not reachable from the tenant admin console" (FR-012) is a *structural* guarantee with its
own auth cookie and origin, not a convention that a future refactor could erode. The platform API stays
on the existing service under the already-isolated `/v1/platform/*` and `/v1/ops/*` groups.

## Complexity Tracking

| Violation / Added Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------------------------|------------|--------------------------------------|
| Separate `apps/platform` Next.js app | FR-012 requires the cross-tenant surface to be unreachable from the tenant admin console; a distinct origin + cookie makes isolation structural | A gated route group inside `apps/admin` shares the app shell and risks cookie/session bleed and accidental cross-linking — exactly the class of defect this feature fixes |
| New platform-global `platform_operators` table | A platform identity must exist outside any tenant; reusing `staff_accounts` would conflate tenant-scoped and platform-global auth (forbidden by ADR-0005 / constitution) | Overloading `staff_accounts` with a "global" tenant breaks RLS assumptions and the split-auth invariant |
| In-memory platform session store (v1) | Parity with the existing staff-session approach (ADR-0017); localized to swap later | A shared/persistent store now is extra scope before deploy; recorded as the same follow-up as staff sessions |
