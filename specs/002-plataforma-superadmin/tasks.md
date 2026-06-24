---
description: "Task list for feature 002 — Plataforma Superadmin"
---

# Tasks: Plataforma Superadmin

**Input**: Design documents from `/specs/002-plataforma-superadmin/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/platform-api.md, quickstart.md

**Tests**: Included — the constitution's Delivery Workflow requires tests for tenant isolation and
integration boundary behavior. Write each test before its implementation and ensure it fails first.

**Organization**: Tasks are grouped by user story (US1–US4) so each can be implemented and tested
independently. Paths follow the modular monolith layout in plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4; Setup/Foundational/Polish carry no story label

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Scaffold the `apps/platform` Next.js App Router app (importing `packages/ui` design
  tokens + `lucide-react`, Spanish strings, no emojis); register it in `pnpm-workspace.yaml` and
  TypeScript project references; confirm `next build` passes on an empty shell.
- [x] T002 [P] Add optional `PLATFORM_BOOTSTRAP_SECRET` (validated when present) to
  `packages/contracts/src/environment.ts`; document it in `.env.example` and
  `docs/operations/SETUP.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Platform identity + the auth gate block all platform user stories (US1–US3).

- [x] T003 SQL migration `infra/postgres/009-platform-operators.sql`: platform-global
  `platform_operators` (id, unique email, scrypt `password_hash`, display_name, status, timestamps),
  **no** `apply_tenant_rls`; unique index on email. Also add/confirm `tenants.status`
  (`active`/`suspended`, default `active`), idempotent.
- [x] T004 Mirror `platform_operators` and `tenants.status` in `packages/persistence/src/schema.ts`.
- [x] T005 [P] Define the `PlatformOperatorStore` port + an in-memory adapter under
  `services/api/src/application/identity/` (create/find-by-email/count/list).
- [x] T006 [P] Implement `DrizzlePlatformOperatorRepository` in `packages/persistence` against the
  platform-global table (no tenant context).
- [x] T007 Add an optional `platformAuth` dep to `buildApp` and a platform-session gate over
  `/v1/platform/*` (except the bootstrap route) and `/v1/ops/*` in
  `services/api/src/api/availability-routes.ts` (these groups are already tenant-resolution-exempt).
- [x] T008 Create `services/api/src/api/platform-routes.ts` (registered by `buildApp`) and wire
  `platformAuth` + `PLATFORM_BOOTSTRAP_SECRET` into both bootstraps in `services/api/src/main.ts`
  (in-memory and persistent).

**Checkpoint**: Platform table, store, and the gate scaffold exist; user stories can begin.

---

## Phase 3: User Story 1 — Platform operator signs in to a protected surface (Priority: P1) 🎯 MVP

**Goal**: A platform identity exists; the platform surface is locked without a platform session; the
operator can bootstrap the first account, sign in, and sign out.

**Independent Test**: Quickstart Scenarios 1 & 2 — bootstrap is gated/self-locking; `/v1/ops` and
`/v1/platform` reject unauthenticated and tenant-session requests; login grants access.

### Tests for User Story 1

- [x] T009 [P] [US1] Unit test the bootstrap self-lock + secret rule (pure) in
  `tests/unit/identity/platform-bootstrap.test.ts`.
- [x] T010 [P] [US1] Unit test platform password hash/verify + uniform-timing failure in
  `tests/unit/identity/platform-password.test.ts`.
- [x] T011 [P] [US1] e2e in `tests/e2e/platform-auth.test.ts`: bootstrap 201 → 409 (self-locked) →
  403 (bad secret); login sets `platform_session`; `/v1/ops/tenants` 401 without session and 403 with
  a tenant `staff_session`; logout invalidates.

### Implementation for User Story 1

- [x] T012 [US1] Implement `PlatformAuthService` in
  `services/api/src/application/identity/platform-auth-service.ts` (scrypt reuse per ADR-0017,
  `authenticate` → opaque `platform_session` cookie, `getSession`, `logout`, in-memory session map,
  placeholder-hash uniform timing, audited login/logout via the platform/global context).
- [x] T013 [US1] Implement `POST /v1/platform/operators/bootstrap` in `platform-routes.ts`
  (constant-time secret compare, succeeds only while zero operators exist, self-locks → 409); audit
  `platform.operator.bootstrapped`.
- [x] T014 [US1] Implement `POST /v1/platform/sessions` (login), `DELETE /v1/platform/sessions`
  (logout), and `POST /v1/platform/operators` (gated create) in `platform-routes.ts`; audit
  `platform.operator.login`/`logout`/`created`.
- [x] T015 [US1] Enforce the gate behavior in `availability-routes.ts`: 401 without a platform
  session; 403 for a `staff_session`/customer session (sessions not interchangeable).
- [x] T016 [US1] Build the `apps/platform` login page + server-only API client (tenant-less platform
  origin) and post-login redirect in `apps/platform/src/app/`.

**Checkpoint**: Platform surface is locked and an operator can sign in — the security-critical MVP.

---

## Phase 4: User Story 2 — Provision and manage tenant lifecycle (Priority: P2)

**Goal**: An authenticated operator provisions tenants, bootstraps the first tenant admin, and
suspends/reactivates tenants; provisioning is no longer open.

**Independent Test**: Quickstart Scenarios 3 & 4 — provision + bootstrap admin require a platform
session; suspension blocks new staff sign-ins and new public bookings while preserving data and
confirmed future bookings; reactivation restores operation.

### Tests for User Story 2

- [x] T017 [P] [US2] e2e in `tests/e2e/platform-tenant-lifecycle.test.ts`: provision → bootstrap
  admin (both gated) → suspend → reactivate; audit actor is the operator.
- [x] T018 [P] [US2] Integration in `tests/integration/tenancy/tenant-suspension.test.ts`: suspended
  tenant blocks staff login + public checkout, preserves existing/future bookings; reactivation
  restores.

### Implementation for User Story 2

- [x] T019 [US2] Add a tenant lifecycle update method to the tenant repository/service (both
  adapters) for `status` transitions, audited.
- [x] T020 [US2] Implement `PATCH /v1/platform/tenants/:tenantId` (status active/suspended) in
  `platform-routes.ts`; audit `tenant.suspended`/`tenant.reactivated`. (Existing
  `POST /v1/platform/tenants` and `.../staff` are now gated by the Phase 2 gate.)
- [x] T021 [US2] Enforce suspension in `services/api/src/infrastructure/tenancy/tenant-resolver.ts`
  via a pure application-layer decision: reject suspended tenants for staff sign-in and public
  booking/checkout; never touch confirmed bookings.
- [x] T022 [US2] Build the `apps/platform` tenant provisioning + lifecycle UI (list tenants, create
  tenant, bootstrap first admin, suspend/reactivate) in `apps/platform/src/`.

**Checkpoint**: Tenant onboarding/offboarding is a controlled, audited platform action.

---

## Phase 5: User Story 3 — Cross-tenant operations on the platform surface (Priority: P3)

**Goal**: The operations overview lives on the gated platform surface, aligned to the design system,
unreachable from the tenant admin console.

**Independent Test**: Quickstart Scenario 5 — operator sees all tenants' billing/usage/audit; a
tenant admin cannot reach it; cross-tenant reads use the platform/global path (no RLS widening).

### Tests for User Story 3

- [ ] T023 [P] [US3] Integration in `tests/integration/operations/ops-access.test.ts`:
  `/v1/ops/tenants` requires a platform session; tenant session → 403; RLS isolation holds (no tenant
  context reads another tenant).

### Implementation for User Story 3

- [ ] T024 [US3] Confirm `/v1/ops/*` is gated (Phase 2) and that the ops feed reads cross-tenant data
  via the platform/global persistence path (no widened `app.current_tenant_id`).
- [ ] T025 [US3] Move the operations feature from `apps/admin/src/features/operations` into
  `apps/platform/src/features/operations`; remove it from the `apps/admin` navigation/routes.
- [ ] T026 [US3] Realign the operations UI to the design system in `apps/platform` (design tokens +
  `lucide-react` + Spanish strings + no emojis; remove Tailwind/English deviation).

**Checkpoint**: Cross-tenant monitoring is platform-only and design-system-consistent.

---

## Phase 6: User Story 4 — Provider ↔ staff login link (Priority: P3, tenant-scoped)

**Goal**: A tenant admin optionally links a catalog provider to a staff login (one-to-one), keeping
the two concepts separate.

**Independent Test**: Quickstart Scenario 6 — link, one-to-one conflict rejected, optional both
sides, unlink leaves both records intact.

### Tests for User Story 4

- [ ] T027 [P] [US4] Integration in `tests/integration/identity/staff-provider-link.test.ts`: link,
  duplicate-provider 409, optional both sides, unlink, no dangling reference on removal.

### Implementation for User Story 4

- [ ] T028 [US4] SQL migration `infra/postgres/010-staff-provider-link.sql`: nullable
  `staff_accounts.provider_id` (FK → `providers.id`), partial unique index on
  `(tenant_id, provider_id)` where not null; mirror in `packages/persistence/src/schema.ts`.
- [ ] T029 [US4] Add set/clear/find provider-link methods to the `StaffAccountStore` port and both
  adapters (in-memory + Drizzle), tenant-scoped under RLS.
- [ ] T030 [US4] Implement `PATCH /v1/admin/staff/:staffId` `{ providerId }` under the staff-auth
  gate (409 on one-to-one conflict, 404 on missing); audit `staff.provider.linked`/`unlinked`.
- [ ] T031 [US4] Add link/unlink UI to the `apps/admin` staff/provider management screen.

**Checkpoint**: Providers can be bound to a login without merging the entities.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T032 [P] Update `docs/operations/SETUP.md`, `.env.example`, and `TECH_DEBT.md` (platform session
  store, login rate limiting, MFA/SSO, finer platform roles — shared follow-ups with staff auth).
- [ ] T033 Run `quickstart.md` Scenarios 1–6 against the local stack (Postgres+Redis+API persistent
  mode) and fill the acceptance status table.
- [ ] T034 [P] Update `PROGRESS.md`, `HANDOFF.md`, and check off completed tasks here in `tasks.md`.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → no dependencies.
- **Foundational (P2)** → after Setup; **blocks US1–US3** (platform table + gate).
- **US1 (Phase 3)** → after Foundational. The platform auth MVP.
- **US2 (Phase 4)** → after US1 (relies on the gate + sessions).
- **US3 (Phase 5)** → after Foundational; practically after US1 (gate). Independent of US2.
- **US4 (Phase 6)** → after Setup/Foundational only; **independent of US1–US3** (tenant-scoped, own
  migration). Can be built in parallel with the platform stories.
- **Polish (Phase 7)** → after the desired stories.

### Within each story

- Tests written first and failing → migrations/schema → store/service → routes → UI.

### Parallel opportunities

- Setup T001/T002 in parallel.
- Foundational T005/T006 in parallel (after T003/T004).
- All `[P]` test tasks within a story in parallel.
- **US4 can proceed in parallel with US1–US3** (no shared files; separate migration and routes).

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & VALIDATE** (Quickstart 1–2):
the platform surface is locked and the operator can sign in. This alone closes the unauthenticated
cross-tenant/provisioning exposure for the gated routes.

### Incremental delivery

US1 (lockdown + login) → US2 (provisioning + lifecycle) → US3 (operations surface moved + DS) → US4
(provider↔staff link, parallelizable). Each increment is independently testable and deployable.

---

## Notes

- `[P]` = different files, no incomplete-task dependencies.
- Constitution gates apply: platform identity is platform-global (no RLS); cross-tenant reads use the
  global path, never a widened tenant context; every platform action is audited; no secret in source.
- Drizzle/RLS integration suites self-skip without PostgreSQL (existing convention).
- Commit after each task or logical group; keep commits signed.
- Architecture recorded in ADR-0022; cross-cutting decisions in ADR-0021.
