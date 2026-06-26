# ADR-0022: Platform Superadmin — Separate Surface And Platform-Global Identity

**Date**: 2026-06-24
**Status**: accepted
**Deciders**: Project owner (javier@ikarum.com) + agent
**Refines**: ADR-0005 (split staff/customer auth), ADR-0017 (staff auth implementation); implements
ADR-0021 decision #7. Spec: `specs/002-plataforma-superadmin/`.

## Context

The cross-tenant operations view lives unprotected inside `apps/admin`, and tenant provisioning
(`POST /v1/platform/tenants`, `POST /v1/platform/tenants/:id/staff`) accepts unauthenticated
requests — the largest security gap in the admin walkthrough. The platform operator (SaaS owner) is a
distinct actor from any tenant's staff and needs its own authenticated surface. Feature 002's spec and
plan resolved the open questions; this ADR records the durable architecture decisions.

## Decision

- **Separate platform surface.** The platform/superadmin UI is a new, thin Next.js app
  (`apps/platform`) with its own origin and `platform_session` cookie, **not** a gated route group
  inside `apps/admin`. The operations dashboard moves out of `apps/admin` into `apps/platform` and is
  realigned to the design system (ADR-0008: design tokens, `lucide-react`, Spanish, no emojis).
- **Platform-global identity.** A new `platform_operators` table (platform-global, **no RLS**, like
  `tenants`/`tenant_domains`): id, unique email, scrypt `password_hash` (ADR-0017 format),
  display_name, status. Single role (`platform_operator`) for v1.
- **Reuse the staff-auth pattern.** `PlatformAuthService` mirrors `StaffAuthService`: opaque
  HttpOnly+Secure `platform_session` cookie, constant-time verification, in-memory session map for v1
  (shared/persistent store is the same documented follow-up as staff sessions). Platform, staff, and
  customer sessions are distinct namespaces and **not interchangeable** (ADR-0005).
- **Platform-auth gate.** `buildApp` gains an optional `platformAuth` dep gating all `/v1/platform/*`
  (except the self-locking bootstrap) and `/v1/ops/*` routes (today open, already exempt from tenant
  resolution). A tenant/customer session presented there is rejected (403).
- **Self-locking bootstrap.** `POST /v1/platform/operators/bootstrap` is gated by env
  `PLATFORM_BOOTSTRAP_SECRET` (constant-time compare) and succeeds only while zero operators exist;
  it self-locks afterward. Secret and credentials stay outside source control.
- **Tenant lifecycle.** `PATCH /v1/platform/tenants/:id` sets `active`/`suspended`. Suspension is
  enforced at the tenant resolver: it blocks new tenant staff sign-ins and new public
  bookings/checkout, preserves all data including already-confirmed future bookings, and is
  reversible.
- **Provider ↔ staff link (tenant-scoped).** Nullable `staff_accounts.provider_id` (FK →
  `providers.id`, unique within tenant) gives an optional one-to-one link; both sides stay
  independent and the link clears on either side's removal. Managed under the existing staff-auth
  gate. "Provider" (catalog) and "staff account" (login) remain separate concepts.
- **Audit.** Tenant-affecting platform actions are audited under the affected tenant (actor = platform
  operator, flagged as platform); platform-only actions are audited via the platform/global context.

## Alternatives Considered

- **Gated area inside `apps/admin`**: less infrastructure, but shares the app shell and cookie space —
  risks session bleed and the exact cross-tenant exposure being fixed. Rejected; the owner chose the
  separate app for structural isolation.
- **Reuse `staff_accounts` with a synthetic "global" tenant**: breaks RLS assumptions and the
  split-auth invariant. Rejected.
- **DB seed / always-open create endpoint for the first operator**: ties credentials to seed/CI
  artifacts or reintroduces an open privileged endpoint. Rejected in favour of the self-locking,
  secret-gated bootstrap.
- **Auto-cancel future bookings on suspension**: destructive and irreversible. Rejected per the
  clarified semantics.

## Consequences

- Closes the cross-tenant exposure and the open provisioning endpoints structurally.
- Adds one delivery surface (`apps/platform`) and two migrations (`009-platform-operators.sql`,
  `010-staff-provider-link.sql`); no new service and no new third-party dependency.
- New env: `PLATFORM_BOOTSTRAP_SECRET` (optional in the contract, validated when present).
- Follow-ups (shared with staff auth): persistent/shared session store, login rate limiting, optional
  MFA/SSO and finer platform roles.
- Implementation backlog generated via `/speckit-tasks` in `specs/002-plataforma-superadmin/tasks.md`.
