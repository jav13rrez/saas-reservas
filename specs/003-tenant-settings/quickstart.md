# Quickstart & Acceptance: Tenant Settings

**Feature**: 003-tenant-settings | **Date**: 2026-06-26

Validation scenarios mapped to the spec's user stories and success criteria. Each is exercised by an
automated test (unit/integration/e2e per the plan's Test Plan) and can also be reproduced by hand
against a running stack (`api` mode) as noted.

## Preconditions

- A provisioned tenant with a bootstrapped **admin** staff account (feature 001/002 flow).
- API running (in-memory for tests; persistent `api` mode for the manual curl path).
- An authenticated `staff_session` cookie for the admin (via `POST /v1/admin/sessions`).

---

## S1 — Read current settings (US1, SC-001)

1. `GET /v1/admin/settings` with the admin session.
2. **Expect** `200` with `profile`, `localization` (timezone, locale, currency), `policies`, and
   `branding` reflecting the tenant's current values.

## S2 — Change localization & profile, persisted (US1, SC-001)

1. `PATCH /v1/admin/settings` `{ "profile": { "displayName": "Peluquería Ana" },
   "localization": { "defaultTimezone": "Europe/Madrid", "defaultLocale": "es-ES", "currency": "USD" } }`.
2. **Expect** `200` with the updated projection.
3. `GET /v1/admin/settings` again → **Expect** the new display name, timezone, locale, and currency.
4. Restart the API (persistent mode) and re-read → values **survive** the restart.

## S3 — Invalid input rejected, no partial write (US1/US2/US3, SC-007)

1. `PATCH /v1/admin/settings` `{ "localization": { "defaultTimezone": "Mars/Phobos", "currency": "EUR" } }`.
2. **Expect** `400 invalid-timezone`; a follow-up `GET` shows the timezone **unchanged** (the valid
   `currency` in the same body was **not** applied — all-or-nothing).
3. Repeat with `currency: "eur"` → `400 invalid-currency`; with `bookingHorizonDays: 0` →
   `400 policy-out-of-range`; with `branding.primaryColor: "blue"` → `400 invalid-color`; with
   `profile.displayName: "   "` → `400 invalid-display-name`. Each leaves all fields unchanged.

## S4 — Currency change is non-retroactive (US1, SC-005)

1. Note an existing service's stored `currency` (e.g. `EUR`).
2. `PATCH /v1/admin/settings` `{ "localization": { "currency": "USD" } }` → `200`.
3. **Expect** the existing service still reports `currency: EUR`; existing bookings/payments unchanged.
4. Create a **new** service → it inherits `currency: USD`.

## S5 — Booking horizon reflected by availability (US2, SC-003)

1. `PATCH /v1/admin/settings` `{ "policies": { "bookingHorizonDays": 7 } }` → `200`.
2. `GET /v1/public/availability` for a date **8+ days** ahead → **Expect** no slots (outside horizon).
3. `PATCH` horizon back to `60` → availability for that date returns slots again.

## S6 — Cancellation/reschedule notice enforced (US2, SC-004)

1. `PATCH /v1/admin/settings` `{ "policies": { "cancellationMinNoticeHours": 48 } }` → `200`.
2. Attempt to cancel a booking **within 48h** of its start (customer/portal flow) → **Expect**
   rejection by the existing change-policy engine.

## S7 — Branding override (US3, SC-001)

1. `PATCH /v1/admin/settings` `{ "branding": { "primaryColor": "#0b7d6b" } }` → `200`.
2. **Expect** the public widget renders `#0b7d6b` as the primary color (runtime token override);
   setting `logoUrl` to a valid reference shows the logo, clearing it falls back to no logo.

## S8 — Authorization (US1, SC-002)

1. `GET`/`PATCH /v1/admin/settings` with **no** session → `401`.
2. With a **non-admin** staff session → `403`.
3. With a **customer** session → rejected (`401`/`403`); not interchangeable.

## S9 — Audit trail (all stories, SC-006)

1. After S2/S5/S7, query the audit log → **Expect** `tenant.localization-updated`,
   `tenant.policies-updated`, and `tenant.branding-updated` entries with the admin as actor,
   tenant-scoped.

## S10 — Cross-tenant isolation (SC-001, constitution I)

1. As tenant A's admin, change settings; as tenant B's admin, `GET /v1/admin/settings`.
2. **Expect** tenant B sees only B's settings; no path reads or writes A's settings from B's context.

---

## Acceptance status

| Scenario | User Story | Success Criterion | Status | Covered by |
|----------|-----------|-------------------|--------|------------|
| S1 | US1 | SC-001 | validated | `admin-settings.test.ts` (e2e), `settings.test.ts` (int) |
| S2 | US1 | SC-001 | validated | `admin-settings.test.ts` round-trip |
| S3 | US1/US2/US3 | SC-007 | validated | `admin-settings.test.ts` validation codes + all-or-nothing; `settings.test.ts` |
| S4 | US1 | SC-005 | validated | `admin-settings.test.ts` non-retroactive currency |
| S5 | US2 | SC-003 | covered | booking horizon consumed by the existing availability engine (feature 001) |
| S6 | US2 | SC-004 | covered | notice hours consumed by the existing change-policy engine (feature 001) |
| S7 | US3 | SC-001 | validated | `settings.test.ts` branding; runtime token override (ADR-0008) |
| S8 | US1 | SC-002 | validated | `admin-settings.test.ts` admin-role gate (401) |
| S9 | all | SC-006 | validated | `settings.test.ts` audit actions |
| S10 | all | SC-001 | validated | `settings.test.ts` cross-tenant isolation |

> S5/S6: the policy *values* persist and are read by the engines that feature 001 already tests; this
> feature provides the configuration point, not the engine. The persistence + read-back is validated;
> the engine enforcement is owned by feature 001's suite.
