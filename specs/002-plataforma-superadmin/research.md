# Phase 0 Research: Plataforma Superadmin

**Date**: 2026-06-24 | **Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

All spec ambiguities were resolved in the `/speckit-clarify` session (2026-06-24); no
`NEEDS CLARIFICATION` markers remain. This document records the resulting technical decisions, their
rationale, and the alternatives considered.

## D1 — Platform surface location: separate `apps/platform` app

- **Decision**: Deliver the platform/superadmin UI as a new, thin Next.js app (`apps/platform`) with
  its own origin and `platform_session` cookie, separate from `apps/admin`.
- **Rationale**: FR-012 requires the cross-tenant surface to be unreachable from the tenant admin
  console. A distinct origin + cookie makes that isolation structural rather than a convention. It
  also lets the operations dashboard be rebuilt to the design system cleanly.
- **Alternatives considered**:
  - *Gated route group inside `apps/admin`*: less infra, but shares the app shell and cookie space —
    risks session bleed and the very cross-tenant exposure this feature fixes. Rejected.
  - *Standalone separate service*: unnecessary; the existing Fastify API already isolates
    `/v1/platform/*` and `/v1/ops/*`. Rejected as over-engineering for v1.

## D2 — Platform identity as a platform-global table, reusing the staff-auth pattern

- **Decision**: New platform-global `platform_operators` table (no RLS), with a `PlatformAuthService`
  mirroring `StaffAuthService` (scrypt KDF per ADR-0017, opaque HttpOnly `platform_session` cookie,
  constant-time verification, in-memory session map for v1).
- **Rationale**: A platform identity must exist outside any tenant. The staff-auth implementation is
  proven and reusable; mirroring it minimizes new surface and keeps password handling consistent.
  ADR-0005's split-auth invariant requires platform, staff, and customer sessions to be distinct and
  non-interchangeable.
- **Alternatives considered**:
  - *Reuse `staff_accounts` with a synthetic "global" tenant*: breaks RLS assumptions and the
    split-auth invariant. Rejected.
  - *External IdP / OAuth for operators*: heavier, adds an external dependency before deploy; revisit
    later (MFA/SSO is a documented follow-up). Rejected for v1.

## D3 — First-operator bootstrap: deployment-secret-gated, self-locking

- **Decision**: `POST /v1/platform/operators/bootstrap` requires env `PLATFORM_BOOTSTRAP_SECRET`
  (constant-time compare) and succeeds only while zero operators exist; it self-locks thereafter.
- **Rationale**: Resolves the chicken-and-egg cleanly without a permanently-open endpoint; the secret
  is environment configuration kept outside source control (constitution Security & Privacy; SC-006).
- **Alternatives considered**:
  - *DB seed/migration*: ties the credential to the seed process and source/CI artifacts. Rejected.
  - *Always-open "create operator" endpoint*: reintroduces an open privileged endpoint. Rejected.

## D4 — Tenant suspension enforced at the resolver; data preserved

- **Decision**: A `suspended` tenant status blocks new tenant staff sign-ins and new public
  bookings/checkout at the tenant resolver; existing data and already-confirmed future bookings are
  untouched; reactivation restores full operation. The decision is a pure application-layer function.
- **Rationale**: Matches the clarified semantics (FR-021), reuses the resolver's existing
  inactive-tenant handling path, and keeps booking correctness intact (constitution II) — suspension
  only *adds* a precondition.
- **Alternatives considered**:
  - *Auto-cancel future bookings on suspension*: destructive and irreversible, fires customer
    notifications. Rejected per the clarification.
  - *Full read lockout*: heavier and unnecessary for operating the platform. Rejected.

## D5 — Provider ↔ staff link via a nullable, tenant-unique column

- **Decision**: Add nullable `staff_accounts.provider_id` (FK → `providers.id`, unique within tenant)
  for an optional one-to-one link; both sides stay independent and the link clears on either side's
  removal.
- **Rationale**: Smallest change that satisfies FR-016–FR-019, stays tenant-scoped under existing RLS,
  and keeps "provider" (catalog) and "staff account" (login) as separate concepts per ADR-0021 #7.
- **Alternatives considered**:
  - *Merge provider and staff into one entity*: contradicts ADR-0021 #7 and couples catalog to auth.
    Rejected.
  - *Separate join table*: unnecessary for a one-to-one optional link. Rejected.

## D6 — Audit routing for platform actions

- **Decision**: Tenant-affecting platform actions are audited under the affected tenant (actor =
  platform operator, flagged as a platform actor); platform-only actions are audited via the
  platform/global context. Reuses the existing event-sink/audit infrastructure.
- **Rationale**: Satisfies constitution principle V and FR-011 without inventing a parallel audit
  system; keeps per-tenant audit views complete while recording platform-only events globally.
- **Alternatives considered**:
  - *Single platform-global audit log for everything*: tenant admins would lose visibility of
    platform actions affecting their tenant. Rejected.
