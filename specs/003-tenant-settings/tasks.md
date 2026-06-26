---
description: "Task list for feature 003 — Tenant Settings"
---

# Tasks: Tenant Settings

**Input**: Design documents from `/specs/003-tenant-settings/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-settings-api.md, quickstart.md

**Tests**: Included — the constitution's Delivery Workflow requires tests for tenant isolation and
integration boundary behavior. Write each test before its implementation and ensure it fails first.

**Organization**: Tasks are grouped by user story (US1–US3) so each can be implemented and tested
independently. Paths follow the modular monolith layout in plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US3; Setup/Foundational/Polish carry no story label

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Add `DEFAULT_CURRENCY = "EUR"` and an ISO-4217 allowlist constant to
  `packages/domain/src/tenancy/tenant.ts` (no behavior change yet); export for reuse.
- [x] T002 [P] Add `MESSAGING`/currency-independent note to `.env.example` only if needed — otherwise
  no env change (this feature adds none). Confirm `docs/operations/SETUP.md` lists the settings
  surface as admin-gated. (Documentation-only.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: The currency field, persistence, service orchestrator, and the admin route pair
block all three user stories.

- [x] T003 Add `currency: string` to the `Tenant` interface and `assertValidCurrency(code)` in
  `packages/domain/src/tenancy/tenant.ts`; call it from `validateTenant`. Unit test first
  (`tests/unit/tenancy/currency.test.ts`): accept EUR/USD/GBP, reject `eur`, `EU`, `ZZZ`, ``.
- [x] T004 SQL migration `infra/postgres/011-tenant-currency.sql`:
  `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';` (idempotent,
  backfills existing rows; no RLS change).
- [x] T005 Mirror the column in `packages/persistence/src/schema.ts` (`currency: text("currency").notNull()`)
  and map it on read/write in `packages/persistence/src/repositories/tenant-repository.ts`.
- [x] T006 Update `TenantAdminService.createTenant` and the in-memory tenant repository/seed
  (`services/api/src/seeds/demo-tenants.ts`) to set `currency` (default `DEFAULT_CURRENCY`), keeping
  existing call sites compiling.
- [x] T007 Add `getSettings(tenantId)`, `updateLocalization(...)`, and the all-or-nothing
  `updateSettings({ profile?, localization?, policies?, branding?, actor })` orchestrator to
  `services/api/src/application/tenancy/tenant-admin-service.ts` (one merge → one `validateTenant` →
  persist → one audit event per changed group). Unit test first for the all-or-nothing merge.
- [x] T008 Create `services/api/src/api/admin-settings-routes.ts` with `GET /v1/admin/settings` and
  `PATCH /v1/admin/settings`, registered by `buildApp` as an optional `tenantSettings` dep, behind the
  staff-auth admin-role gate (401/403). The tenant is request-resolved (no path param).
- [x] T009 Wire the `tenantSettings` dep into both bootstraps in `services/api/src/main.ts`
  (in-memory and persistent), reusing `TenantAdminService` + `EventSink`.

**Checkpoint**: Currency exists end to end; the admin settings route pair is reachable and gated.
User stories can begin.

---

## Phase 3: User Story 1 — Localization & profile (Priority: P1) 🎯 MVP

**Goal**: An admin sets display name, time zone, locale, and currency; values persist and are read
back; invalid input is rejected all-or-nothing; non-admin/customer rejected.

- [x] T010 [P] [US1] Integration test `tests/integration/settings/localization.test.ts` (in-memory
  always; Drizzle/RLS self-skips): read settings; PATCH localization+profile persists + audits
  `tenant.localization-updated`; invalid timezone/currency/blank-name rejected with **no partial
  write**; cross-tenant isolation (tenant A's settings unreachable under tenant B).
- [x] T011 [P] [US1] E2E test `tests/e2e/admin-settings.test.ts`: admin `GET → PATCH → GET` reflects
  new localization; non-admin staff session → 403; customer session rejected.
- [x] T012 [US1] Implement the `localization`/`profile` branch of `PATCH /v1/admin/settings` (maps to
  `updateSettings`) and `GET` projection; map the `400` error codes from the contract
  (`invalid-timezone`, `invalid-currency`, `invalid-locale`, `invalid-display-name`). Make T010/T011
  green.
- [x] T013 [US1] Admin console seam: `apps/admin/src/server/source/settings.ts` (demo vs api) +
  `apps/admin/app/api/settings/route.ts` (GET/PATCH); demo store `getSettings`/`updateSettings` over
  the in-memory tenant in `apps/admin/src/server/demo-store.ts`.
- [x] T014 [US1] Admin Settings screen scaffold `apps/admin/src/features/settings/` with the
  **Perfil** + **Localización** sections (display name, timezone, locale, currency), design tokens +
  Lucide icons + Spanish + no emojis; one Save → one PATCH. `next build` passes.

**Checkpoint**: US1 is independently demonstrable — localization/profile editable, persisted, audited,
gated.

---

## Phase 4: User Story 2 — Booking policies (Priority: P2)

**Goal**: An admin sets booking horizon, cancellation/reschedule notice, and requires-approval; the
public widget horizon and the change/cancel policy engine honor the saved values.

- [x] T015 [P] [US2] Integration test `tests/integration/settings/policies.test.ts`: PATCH policies
  persists + audits `tenant.policies-updated`; out-of-range (negative notice, horizon < 1) rejected
  with no partial write.
- [x] T016 [P] [US2] E2E test in `tests/e2e/admin-settings.test.ts`: after PATCH `bookingHorizonDays`,
  `GET /v1/public/availability` for a date beyond the horizon returns no slots; restoring the horizon
  returns slots.
- [x] T017 [US2] Implement the `policies` branch of `PATCH /v1/admin/settings` (maps to the existing
  `updatePolicies` via `updateSettings`); map `policy-out-of-range`. Make T015/T016 green.
- [x] T018 [US2] Add the **Políticas de reserva** section to the Settings screen (horizon, cancel
  notice, reschedule notice, requires-approval toggle), through the seam in both modes.

**Checkpoint**: US2 independently demonstrable — policies editable and enforced by existing engines.

---

## Phase 5: User Story 3 — Branding (Priority: P3)

**Goal**: An admin sets primary color and logo; the widget/admin reflect the tenant's primary color
at runtime; invalid color rejected.

- [x] T019 [P] [US3] Integration test `tests/integration/settings/branding.test.ts`: PATCH branding
  persists + audits `tenant.branding-updated`; invalid hex color rejected; set/clear logo valid.
- [x] T020 [US3] Implement the `branding` branch of `PATCH /v1/admin/settings` (maps to the existing
  `updateBranding` via `updateSettings`); map `invalid-color`/`invalid-logo`. Make T019 green.
- [x] T021 [US3] Add the **Marca** section to the Settings screen (primary color picker + logo
  reference), through the seam; confirm the booking widget renders the saved `primaryColor` as the
  runtime token override.

**Checkpoint**: All three user stories complete; the Settings surface replaces the wizard-style
"Configuración".

---

## Phase 6: Polish & Cross-Cutting

- [x] T022 [P] Write `docs/adr/0023-tenant-settings-persistence.md`: extend the `tenants` registry
  with a `currency` column instead of a separate `tenant_settings` table; record the deviation from
  ADR-0021 #4's wording and the per-location-override revisit trigger.
- [x] T023 [P] Validate quickstart S1–S10; update the acceptance status table in `quickstart.md` to
  `validated`.
- [x] T024 Run the full suite (typecheck, lint, Prettier, tests); confirm green (Drizzle/RLS
  self-skips without PostgreSQL) and `apps/admin` `next build` passes.
- [x] T025 [P] Update continuity docs at session close: `PROGRESS.md` (dated entry), `HANDOFF.md`
  (resume point), mark feature 003 tasks complete; note in `TECH_DEBT.md` that migration `011` is
  pending production apply.

---

## Dependencies & parallelization

- **Phase 2 blocks everything**: T003→T005 (domain→schema→repo), T007 (service), T008→T009 (route→wire).
- **Within a story**: tests (`[P]`) precede implementation; the UI task follows the route branch.
- **Across stories**: US1 establishes the screen + seam; US2/US3 add sections to the same screen, so
  their UI tasks (T018, T021) depend on T013/T014 but their backend branches (T017, T020) are
  independent and can be built in parallel after Phase 2.
- **Polish** runs after US1–US3.

## Implementation strategy

MVP = Phase 2 + **US1** (the only story with a genuinely new field, currency, and the foundational
settings surface). US2 and US3 mostly wire already-existing orphaned service methods
(`updatePolicies`/`updateBranding`) into the new surface and add UI sections, so they are low-risk
increments on top of US1.
