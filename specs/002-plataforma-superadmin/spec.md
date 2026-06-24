# Feature Specification: Plataforma Superadmin

**Feature Branch**: `002-plataforma-superadmin`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "plataforma-superadmin — auth de plataforma; superficie de superadmin separada del admin de tenant; mover Operaciones (vista cross-tenant) y la provisión de tenants detrás de auth de superadmin; cerrar el agujero de seguridad por el que hoy cualquiera ve todos los tenants y crea tenants sin autenticación; permitir vincular un proveedor (catálogo) a una cuenta de staff con login."

## Context (non-normative)

This feature implements decision #7 of ADR-0021 (cross-cutting product decisions). Today the
cross-tenant operations view lives **inside the tenant admin app and is unprotected**, and tenant
provisioning endpoints accept requests with **no platform authentication**. Anyone who can reach
the operations screen sees every tenant's data, and anyone who can reach the provisioning endpoint
can create tenants. This is the largest security gap found in the admin walkthrough. The platform
operator (the SaaS owner) is a distinct actor from any tenant's staff and must have its own
authenticated surface, separate from the per-tenant admin console.

## Clarifications

### Session 2026-06-24

- Q: How is the FIRST platform operator created (chicken-and-egg, when no platform identity yet
  exists to authenticate the action)? → A: A one-off bootstrap step gated by a deployment-time
  secret (environment configuration) that self-locks once the first operator exists; credentials
  are kept durably outside source control.
- Q: When a tenant is suspended, what does it block going forward? → A: It blocks new tenant staff
  sign-ins and new public bookings; tenant data is preserved and the tenant can be reactivated.
- Q: On suspension, what happens to already-confirmed future bookings? → A: They are preserved
  as-is (no auto-cancellation); suspension only halts new activity.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Platform operator signs in to a protected platform surface (Priority: P1)

As the SaaS owner (platform operator), I sign in with platform credentials before I can see or do
anything across tenants, so that cross-tenant data and platform actions are never exposed to
unauthenticated visitors or to tenant staff.

**Why this priority**: This is the security-critical core. Until a platform identity exists and
gates the platform surface, every cross-tenant capability is an open door. It is the minimum
viable slice: with only this story, the platform surface is locked and the existing open
cross-tenant feed is no longer reachable without authentication.

**Independent Test**: Attempt to reach any platform surface or platform action without a platform
session and confirm it is rejected; sign in with valid platform credentials and confirm access is
granted; sign in with invalid credentials and confirm rejection without revealing whether the
account exists.

**Acceptance Scenarios**:

1. **Given** no active platform session, **When** a request is made to any cross-tenant view or
   platform action, **Then** it is rejected as unauthenticated.
2. **Given** valid platform credentials, **When** the operator signs in, **Then** a platform
   session is established and the platform surface becomes accessible.
3. **Given** invalid platform credentials, **When** sign-in is attempted, **Then** it is rejected
   with a generic failure that does not disclose whether the email exists, and the attempt is
   recorded.
4. **Given** an active platform session, **When** the operator signs out, **Then** the session is
   invalidated and the platform surface is no longer accessible with it.
5. **Given** a valid **tenant** admin session (not a platform identity), **When** it is used
   against a platform surface or action, **Then** it is rejected as unauthorized.

---

### User Story 2 - Platform operator provisions and manages tenant lifecycle (Priority: P2)

As the platform operator, I create new tenants, bootstrap each tenant's first administrator, and
change a tenant's lifecycle state (e.g. active or suspended) — all only while authenticated as a
platform operator — so that onboarding and offboarding tenants is a controlled, audited platform
action rather than an open endpoint.

**Why this priority**: Tenant provisioning is currently open; closing it is security-critical but
depends on the platform identity from US1 existing first. Lifecycle control (suspend/reactivate) is
needed to operate the platform but is not required for the very first lockdown.

**Independent Test**: With a platform session, create a tenant, bootstrap its first admin, and
suspend then reactivate it; confirm each action is recorded. Without a platform session, confirm
the same actions are rejected.

**Acceptance Scenarios**:

1. **Given** an authenticated platform operator, **When** they provision a new tenant, **Then** the
   tenant is created, the action is audited with the operator as actor, and the tenant appears in
   the platform overview.
2. **Given** a newly provisioned tenant with no staff, **When** the operator bootstraps the first
   tenant administrator, **Then** that administrator can sign in to the tenant admin console and no
   one else could create that first admin without platform authentication.
3. **Given** an active tenant, **When** the operator suspends it, **Then** the tenant is marked
   suspended, the change is audited, and (per Assumptions) tenant-scoped access reflects the
   suspended state.
4. **Given** no platform session, **When** any provisioning or lifecycle action is attempted,
   **Then** it is rejected as unauthenticated.

---

### User Story 3 - Platform operator reviews cross-tenant operations (Priority: P3)

As the platform operator, on the protected platform surface I review every tenant's billing status,
usage against quotas (bookings, storage, notifications), and recent audit activity, so that I can
monitor the health of the platform from one place — and tenant staff can never reach this
cross-tenant view.

**Why this priority**: The operations data already exists and is valuable, but its security defect
is addressed once it sits behind US1's gate. Relocating it to the platform surface and aligning it
to the design system is important polish, not the initial lockdown.

**Independent Test**: As an authenticated platform operator, view the multi-tenant overview with
billing/usage/audit per tenant; confirm a tenant admin session cannot reach it; confirm the view
shows only platform-global aggregates and never lets one tenant's session read another tenant's
data.

**Acceptance Scenarios**:

1. **Given** an authenticated platform operator, **When** they open the operations overview,
   **Then** they see all tenants with billing status, usage/quota indicators, and a per-tenant
   audit activity view.
2. **Given** a tenant admin (no platform identity), **When** they attempt to reach the operations
   overview, **Then** access is denied.
3. **Given** the operations overview, **When** it is rendered, **Then** it follows the product
   design system (design tokens, Lucide icons, Spanish UI, no emojis) consistently with the rest of
   the product.

---

### User Story 4 - Tenant administrator links a provider to a staff login (Priority: P3)

As a tenant administrator, I optionally link a catalog **provider** to a **staff login account**, so
that a provider who needs to sign in is bound to their own catalog record — while keeping "provider"
(a schedulable catalog entity) and "staff account" (a login identity) as separate concepts that are
not forced to merge.

**Why this priority**: This is the second half of ADR-0021 decision #7 and rounds out the auth
model, but it is tenant-scoped and independent of the platform lockdown; it can ship after the
platform surface is secured. It is included here because it belongs to the same auth decision.

**Independent Test**: As a tenant admin, link an existing provider to an existing staff account and
confirm the association is stored and visible; confirm a provider and a staff account can each exist
without the other; confirm a staff account links to at most one provider and a provider to at most
one staff account.

**Acceptance Scenarios**:

1. **Given** an existing provider and an existing staff account in the same tenant, **When** the
   admin links them, **Then** the association is persisted and reflected when viewing either record.
2. **Given** a linked provider–staff pair, **When** the admin removes the link, **Then** both
   records continue to exist independently and the association is gone.
3. **Given** a staff account already linked to a provider, **When** the admin attempts to link it to
   a second provider, **Then** the action is rejected (one-to-one association within the tenant).

---

### Edge Cases

- **First platform operator bootstrap (chicken-and-egg)**: the very first operator is created via a
  deployment-secret-gated bootstrap step that self-locks once an operator exists (resolved — see
  Clarifications, FR-020).
- **Forged identity**: a request presents a fabricated platform session token or a spoofed
  host/forwarded header — it must be rejected; a platform session must not be derivable from any
  tenant-scoped credential, and vice versa.
- **Suspended tenant**: staff sign-ins and new public bookings are blocked; existing future
  bookings are preserved unchanged; data is retained and the tenant is reactivable (resolved — see
  Clarifications, FR-021).
- **Audit isolation**: the per-tenant audit view on the platform surface must read each tenant's
  records without letting any tenant context read another tenant's data.
- **Session expiry**: an expired platform session is treated as unauthenticated.
- **Removing a provider/staff record that is linked**: deleting or deactivating one side must not
  leave a dangling link.

## Requirements *(mandatory)*

### Functional Requirements

**Platform identity & authentication**

- **FR-001**: The system MUST define a **platform operator** identity that is platform-global (not
  tenant-scoped) and distinct from any tenant staff or customer identity.
- **FR-002**: The system MUST authenticate platform operators with credentials and establish a
  platform session that is clearly separable from tenant staff sessions and customer sessions; the
  three session types MUST NOT be interchangeable.
- **FR-003**: The system MUST reject any access to a platform surface or platform action when no
  valid platform session is present.
- **FR-004**: The system MUST reject a tenant staff or customer session that is presented against a
  platform surface or action (authorization failure, not silent success).
- **FR-005**: Platform sign-in failures MUST NOT reveal whether an account exists (no
  user-enumeration via message or timing) and MUST be recorded as security events.
- **FR-006**: The system MUST allow a platform operator to sign out, invalidating the platform
  session.
- **FR-007**: Platform credentials MUST be stored securely (hashed, never reversible) and MUST NOT
  be committed to source control.
- **FR-020**: The system MUST provide a bootstrap path to create the first platform operator that
  is gated by a deployment-time secret (environment configuration), and that path MUST self-lock
  (refuse to create another first operator) once at least one platform operator exists. The
  bootstrap secret and resulting credentials MUST be kept outside source control.

**Protected platform actions (provisioning & lifecycle)**

- **FR-008**: Tenant provisioning MUST require an authenticated platform operator; it MUST NOT be
  reachable without a platform session.
- **FR-009**: Bootstrapping a tenant's first administrator MUST require an authenticated platform
  operator.
- **FR-010**: The system MUST allow a platform operator to change a tenant's lifecycle state (at
  least active and suspended) and MUST reflect that state where tenant access is evaluated.
- **FR-021**: A suspended tenant MUST block new tenant staff sign-ins and new public bookings,
  MUST preserve all existing tenant data, and MUST be reactivable to a fully operational state.
  Already-confirmed future bookings MUST be preserved as-is on suspension (no automatic
  cancellation); suspension only halts new activity.
- **FR-011**: Every platform action (sign-in, sign-out, provisioning, first-admin bootstrap,
  lifecycle change) MUST emit an audit record identifying the platform operator as actor.

**Cross-tenant operations surface**

- **FR-012**: The cross-tenant operations overview MUST live on the platform surface behind platform
  authentication and MUST NOT be reachable from the tenant admin console.
- **FR-013**: The operations overview MUST present, per tenant, billing status, usage against quotas
  (bookings, storage, notifications), and recent audit activity.
- **FR-014**: The operations overview MUST read each tenant's data without allowing any tenant
  context to read another tenant's data (cross-tenant aggregation is a platform-global privilege,
  never a tenant-scoped read).
- **FR-015**: The platform surface UI MUST conform to the product design system (design tokens,
  Lucide-only icons, Spanish user-facing strings, no emojis).

**Provider ↔ staff linkage (tenant-scoped)**

- **FR-016**: A tenant administrator MUST be able to optionally associate a catalog provider with a
  staff login account within the same tenant.
- **FR-017**: A provider and a staff account MUST each be able to exist without the other (the link
  is optional on both sides).
- **FR-018**: The association MUST be one-to-one within a tenant: a staff account links to at most
  one provider and a provider to at most one staff account.
- **FR-019**: The system MUST allow removing the association without deleting either record, and
  MUST NOT leave a dangling link when either record is removed.

### Key Entities *(include if data involved)*

- **Platform Operator**: a platform-global identity representing the SaaS owner/operators. Key
  attributes: identifier, sign-in credential (securely hashed), display name, status. Not scoped to
  any tenant.
- **Platform Session**: a platform-global authenticated session bound to a Platform Operator;
  short-lived, invalidated on sign-out and on expiry; distinct from tenant/customer sessions.
- **Tenant** (existing): the tenant registry record, extended with a lifecycle state (active,
  suspended) that platform operators control.
- **Tenant Administrator** (existing staff account, role admin): the first administrator bootstrapped
  per tenant by a platform operator.
- **Provider–Staff Link** (new association): an optional one-to-one association, within a tenant,
  between a catalog provider and a staff login account.
- **Audit Record** (existing): the audit trail; platform actions are recorded with the platform
  operator as actor and are distinguishable from tenant-scoped actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of cross-tenant views and platform actions are inaccessible without a valid
  platform session (no path reaches cross-tenant data or tenant provisioning unauthenticated).
- **SC-002**: 100% of attempts to use a tenant or customer session against a platform surface are
  rejected.
- **SC-003**: A platform operator can provision a new tenant and bootstrap its first administrator
  in under 5 minutes from the platform surface.
- **SC-004**: Every platform action appears in the audit trail attributed to the acting platform
  operator (verifiable for sign-in, provisioning, first-admin bootstrap, and lifecycle changes).
- **SC-005**: A platform operator can view billing, usage, and audit activity for all tenants from a
  single overview, while no tenant administrator can reach that overview.
- **SC-006**: No platform credential or secret is present in source control.

## Assumptions

- **Reuse of the existing auth foundation**: platform authentication follows the established split
  auth model (ADR-0005) and staff-auth implementation pattern (ADR-0017) — secure password hashing,
  opaque server-side sessions in HttpOnly cookies, constant-time verification — applied to a new
  platform-global identity rather than a tenant-scoped one. The concrete mechanism is decided at
  planning time.
- **First-operator bootstrap (resolved — see Clarifications)**: the first platform operator is
  created via a one-off bootstrap step gated by a deployment-time secret, which self-locks once an
  operator exists; credentials are kept durably outside source control. (FR-020)
- **Tenant suspension semantics (resolved — see Clarifications)**: a suspended tenant blocks new
  tenant staff sign-ins and new public bookings; existing data — including already-confirmed future
  bookings — is preserved unchanged, and the tenant can be reactivated. (FR-021)
- **MFA is out of scope for v1**: platform auth uses password + recorded attempts (and rate limiting
  consistent with the existing follow-ups); stronger factors are a documented follow-up.
- **Platform surface delivery**: whether the platform surface is a separate application or a
  separately-gated area is a delivery/architecture decision for `/speckit-plan`; this spec only
  requires that it is authenticated, cross-tenant-capable, and not reachable from the tenant admin
  console.
- **Design system**: the platform surface adopts the same design system as the rest of the product
  (ADR-0008), correcting the current operations screen's deviation (Tailwind/English).
- **Tenant isolation**: cross-tenant aggregation on the platform surface is a platform-global
  privilege; per-tenant reads still honor Row-Level Security and never widen one tenant's context to
  another's (constitution principle I).
