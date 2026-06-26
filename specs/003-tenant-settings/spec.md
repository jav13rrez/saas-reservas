# Feature Specification: Tenant Settings

**Feature Branch**: `003-tenant-settings`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "tenant-settings — branding por tenant (color primario, logo), políticas
de reserva (horizonte de reserva, antelación de cancelación, antelación de reprogramación, requiere
aprobación), zona horaria/locale y moneda. Una superficie de Configuración real para el tenant
(hoy estos valores solo se fijan en el alta, no hay pantalla de ajustes). Alta prioridad para el
onboarding real."

## Context (non-normative)

This feature implements decision #4 of ADR-0021 (cross-cutting product decisions): booking time
policies (cancellation, reschedule, lead/horizon) and the tenant's **currency** live globally per
tenant. Today the tenant aggregate already carries branding, timezone, locale, and booking policies
(feature 001, T019), but they are only set at provisioning time through the setup wizard — there is
**no settings surface** for a tenant administrator to view and change them after onboarding, and
**currency is not modelled at all**. The walkthrough flagged the current "Configuración" screen as a
sign-up wizard, not a settings page (`docs/analysis/menu-walkthrough-gap-analysis.md`).

This feature delivers the real tenant settings surface: a place where a tenant administrator reviews
and edits the tenant's profile/branding, localization (timezone, locale, currency), and booking
policies — persisted, validated, audited, and reflected by the booking engine and public widget.

Out of scope for this feature (explicitly deferred): per-tenant sender email, payment-gateway
activation, and per-location policy overrides (ADR-0021 #4 and #6 keep these as later extensions);
the booking lifecycle states and manual payments (feature `reservas-ciclo-estados-pagos`); deeper
public-widget appearance customization beyond logo + primary color (ADR-0021 #6 "Customize").

## Clarifications

### Session 2026-06-26

- Q: Who may view and edit tenant settings? → A: Only tenant staff accounts with the **admin** role
  (consistent with the `/v1/admin/*` gate and ADR-0017). Staff with a non-admin role and customers
  cannot reach or change settings.
- Q: Can the tenant's currency be changed after bookings/payments already exist? → A: Yes, the
  currency may be changed at any time, but the change is **non-retroactive**: existing bookings,
  carts, and payments keep the currency they were created with; only new money records use the new
  currency. Changing currency does not convert or re-price historical amounts.
- Q: What is the scope of "branding" in this feature? → A: Primary color (hex) and an optional logo
  reference only — the fields the tenant aggregate already exposes. Richer widget appearance
  (secondary colors, typography, layout) is the later "Customize" extension (ADR-0021 #6) and is out
  of scope here.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tenant administrator configures localization and profile (Priority: P1)

As a tenant administrator, I open a Settings surface and set my business's display name, time zone,
locale, and currency, so that availability, dates, and prices are presented correctly for my market
from the first day of real onboarding.

**Why this priority**: Localization is the foundation the rest of the product reads from — time zone
drives every availability calculation and date display, locale drives formatting, and currency
drives how money is presented and charged. Currency is not modelled today, so this is also the only
story that adds a genuinely new field. With only this story shipped, a tenant can already be
correctly localized after onboarding.

**Independent Test**: As an admin, open Settings, change time zone, locale, display name, and
currency to valid values, save, and confirm the values persist and are reflected where the tenant is
read (availability time zone, money currency). Submit invalid values (unknown time zone, non-ISO
currency) and confirm they are rejected without partial saves.

**Acceptance Scenarios**:

1. **Given** an authenticated tenant admin, **When** they open the Settings surface, **Then** they
   see the tenant's current display name, time zone, locale, and currency.
2. **Given** valid values, **When** the admin saves a new time zone, locale, display name, and
   currency, **Then** the changes persist, the action is audited with the admin as actor, and
   subsequent reads of the tenant reflect the new values.
3. **Given** an invalid time zone (not an IANA zone) or an invalid currency (not ISO-4217), **When**
   the admin attempts to save, **Then** the save is rejected with a clear validation message and no
   value is changed (all-or-nothing).
4. **Given** a tenant with existing bookings priced in the previous currency, **When** the admin
   changes the currency, **Then** historical bookings/payments keep their original currency and only
   new money records use the new currency.
5. **Given** a non-admin staff session or a customer session, **When** it is used to read or change
   settings, **Then** the request is rejected as unauthorized.

---

### User Story 2 - Tenant administrator configures booking policies (Priority: P2)

As a tenant administrator, I set the booking horizon, the minimum notice required to cancel and to
reschedule, and whether new bookings require staff approval, so that the public widget and the
change/cancel flows enforce my business rules.

**Why this priority**: The policy engine already exists (feature 001, User Story 3) and the public
widget already honors the booking horizon; this story gives the admin the configuration point that
feeds them. It is high-value for real operations but not required to be correctly localized, so it
follows US1.

**Independent Test**: As an admin, set a booking horizon, cancellation notice, reschedule notice,
and the requires-approval flag; confirm the public widget offers slots only within the horizon and
the change/cancel flow enforces the configured notice windows. Submit out-of-range values and
confirm rejection.

**Acceptance Scenarios**:

1. **Given** an authenticated tenant admin, **When** they save a booking horizon of N days, **Then**
   the public widget offers slots only up to N days ahead.
2. **Given** a cancellation minimum notice of H hours, **When** a customer attempts to cancel within
   H hours of the start time, **Then** the cancellation is rejected by the existing policy engine.
3. **Given** a reschedule minimum notice of H hours, **When** a customer attempts to reschedule
   within H hours of the start time, **Then** the reschedule is rejected by the policy engine.
4. **Given** the requires-approval flag, **When** it is enabled, **Then** the configured value is
   persisted and exposed for the booking flow to read (the lifecycle behavior itself belongs to
   `reservas-ciclo-estados-pagos`).
5. **Given** an out-of-range policy value (negative notice hours, or a horizon below 1 day), **When**
   the admin attempts to save, **Then** the save is rejected and no policy value is changed.
6. **Given** a policy change, **When** it is saved, **Then** the change is audited with the admin as
   actor.

---

### User Story 3 - Tenant administrator sets branding (Priority: P3)

As a tenant administrator, I set my brand's primary color and logo, so that the admin console and the
public booking widget reflect my brand instead of the platform default.

**Why this priority**: Branding is visible polish that improves the onboarding experience but does
not affect booking correctness or localization. It ships after the functional settings.

**Independent Test**: As an admin, set a primary color and a logo reference, save, and confirm the
booking widget and admin surfaces render the tenant's primary color (overriding the design-system
default) and show the logo. Submit an invalid color and confirm rejection.

**Acceptance Scenarios**:

1. **Given** an authenticated tenant admin, **When** they save a valid primary color, **Then** the
   color persists and the public widget renders it as the primary color (runtime token override).
2. **Given** an admin, **When** they set or clear a logo reference, **Then** the change persists and
   surfaces that show the logo reflect it.
3. **Given** an invalid primary color (not a valid hex color), **When** the admin attempts to save,
   **Then** the save is rejected and the previous color is preserved.
4. **Given** a branding change, **When** it is saved, **Then** the change is audited with the admin
   as actor.

---

### Edge Cases

- **Invalid localization**: an unknown IANA time zone, a non-ISO-4217 currency, or an unsupported
  locale must be rejected at save with no partial write.
- **Currency change with history**: changing currency must not retro-convert or re-price existing
  bookings, carts, or payments (resolved — see Clarifications); historical amounts keep their
  original currency.
- **Out-of-range policy**: negative notice hours or a booking horizon below one day must be rejected.
- **Concurrent edits**: two admins saving settings near-simultaneously must not corrupt the record;
  the later write wins on a whole-record save and both are audited (last-write-wins is acceptable for
  v1; optimistic concurrency is a documented follow-up).
- **Cross-tenant isolation**: a settings read or write must only ever affect the acting admin's own
  tenant; no path may read or change another tenant's settings.
- **Empty/whitespace display name**: a blank display name must be rejected (the tenant must keep a
  non-empty name).
- **Logo reference integrity**: the logo is stored as a reference; an empty/cleared logo is valid
  (falls back to no logo), and a malformed reference is rejected.

## Requirements *(mandatory)*

### Functional Requirements

**Settings surface & authorization**

- **FR-001**: The system MUST expose a tenant settings surface where a tenant administrator can read
  the tenant's current display name, time zone, locale, currency, booking policies, and branding.
- **FR-002**: Reading and changing tenant settings MUST require an authenticated tenant staff session
  with the **admin** role; non-admin staff and customers MUST be rejected as unauthorized.
- **FR-003**: Every settings change MUST affect only the acting administrator's own tenant and MUST
  NOT read or modify any other tenant's settings (tenant isolation, constitution principle I).

**Localization & profile (US1)**

- **FR-004**: The system MUST allow an admin to set the tenant's **display name**; a blank or
  whitespace-only name MUST be rejected.
- **FR-005**: The system MUST allow an admin to set the tenant's **time zone**, validated as a valid
  IANA time zone; an invalid zone MUST be rejected.
- **FR-006**: The system MUST allow an admin to set the tenant's **locale**.
- **FR-007**: The system MUST model and allow an admin to set the tenant's **currency**, validated as
  an ISO-4217 currency code; an invalid code MUST be rejected.
- **FR-008**: Changing the currency MUST be non-retroactive: existing bookings, carts, and payments
  MUST keep the currency under which they were created; only new money records use the new currency.

**Booking policies (US2)**

- **FR-009**: The system MUST allow an admin to set the **booking horizon** (how far ahead the public
  widget offers slots), in days, with a minimum of 1 day.
- **FR-010**: The system MUST allow an admin to set the **minimum cancellation notice** and the
  **minimum reschedule notice**, in hours, each ≥ 0.
- **FR-011**: The system MUST allow an admin to set a **requires-approval** flag for new bookings and
  MUST persist and expose it for the booking flow to read.
- **FR-012**: Saved policy values MUST be the ones enforced by the existing booking horizon (public
  widget) and the existing change/cancel policy engine (feature 001, User Story 3).
- **FR-013**: Out-of-range policy values (negative notice, horizon < 1 day) MUST be rejected with no
  partial write.

**Branding (US3)**

- **FR-014**: The system MUST allow an admin to set the tenant's **primary color**, validated as a
  valid hex color; an invalid color MUST be rejected.
- **FR-015**: The system MUST allow an admin to set or clear an optional **logo** reference; an empty
  logo is valid, a malformed reference MUST be rejected.
- **FR-016**: The saved primary color MUST override the design-system default primary token at
  runtime on tenant surfaces (admin and public widget), per the existing branding mechanism
  (ADR-0008).

**Validation, audit & persistence**

- **FR-017**: All settings saves MUST be all-or-nothing: if any field fails validation, no field is
  changed.
- **FR-018**: Every settings change (localization, policies, branding) MUST emit a domain event and
  an audit record identifying the admin as actor (constitution principle V).
- **FR-019**: Tenant settings MUST be persisted durably so the values survive restarts and are read
  by the API, the public widget, and background jobs that act on behalf of the tenant.

### Key Entities *(include if data involved)*

- **Tenant Settings** (new/extended): the per-tenant configuration record holding display name,
  time zone, locale, **currency** (new), booking policies (cancellation notice, reschedule notice,
  booking horizon, requires-approval), and branding (primary color, optional logo). Per ADR-0021 #4
  this is the single global configuration point for the tenant; per-location override is a future
  extension. (The existing tenant aggregate already carries everything except currency; whether the
  settings persist as a dedicated `tenant_settings` record or as columns on the existing tenant
  registry is a `/speckit-plan` decision.)
- **Tenant** (existing): the tenant registry record that other aggregates read for timezone, locale,
  branding, and policies; this feature makes those values editable after provisioning and adds
  currency.
- **Audit Record** (existing): the audit trail; each settings change is recorded with the
  administrator as actor and is tenant-scoped.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A tenant administrator can change time zone, locale, currency, display name, booking
  policies, and branding from a single settings surface, and every saved value persists across a
  restart.
- **SC-002**: 100% of settings reads and writes are rejected without an admin session; no non-admin
  staff or customer path can read or change settings.
- **SC-003**: A change to the booking horizon is reflected by the public widget (slots offered only
  within the new horizon) without any code change.
- **SC-004**: A change to cancellation/reschedule notice is enforced by the existing policy engine
  for new cancel/reschedule attempts.
- **SC-005**: Changing the currency leaves 100% of pre-existing bookings/payments at their original
  currency (no historical amount changes), and new money records use the new currency.
- **SC-006**: Every settings change appears in the audit trail attributed to the acting admin
  (verifiable for localization, policy, and branding changes).
- **SC-007**: Invalid input (unknown time zone, non-ISO currency, negative notice, horizon < 1,
  invalid color, blank name) is rejected with no partial write in 100% of cases.

## Assumptions

- **Reuse of the existing tenant aggregate and policy engine**: branding, timezone, locale, and the
  four booking policies already exist on the tenant aggregate (feature 001, T019) and are already
  consumed by the availability engine, the public widget horizon, and the change/cancel policy engine
  (feature 001, User Story 3). This feature adds the *editing surface* over them and the new currency
  field; it does not re-implement the engines.
- **Persistence shape (resolved at plan time)**: ADR-0021 #4 names a `tenant_settings` record as the
  global configuration point. Whether currency and the editable settings live in a dedicated table or
  as additional columns on the existing tenant registry is a `/speckit-plan` decision; either way the
  values are tenant-scoped and protected by Row-Level Security.
- **Authorization (resolved — see Clarifications)**: only admin-role staff may read/write settings,
  reusing the staff-auth model (ADR-0017) and the `/v1/admin/*` gate.
- **Currency semantics (resolved — see Clarifications)**: currency is ISO-4217, changeable, and
  non-retroactive; money continues to be stored in integer minor units (feature 001). Multi-currency
  per booking is not introduced; currency is a tenant-level default applied at creation time.
- **Branding scope (resolved — see Clarifications)**: primary color + optional logo only; deeper
  widget appearance is the later "Customize" extension (ADR-0021 #6).
- **Out of scope (deferred)**: per-tenant sender email and payment-gateway activation (ADR-0021 #6
  "later"), per-location policy overrides (ADR-0021 #4 future extension), booking lifecycle states and
  manual payments (`reservas-ciclo-estados-pagos`), and optimistic-concurrency control on concurrent
  edits (last-write-wins for v1).
- **Design system**: the settings surface follows the product design system (ADR-0008): design
  tokens from `packages/ui`, Lucide-only icons, Spanish user-facing strings, no emojis.
- **Admin data modes**: the settings surface works in both `apps/admin` data modes (`demo` and
  `api`), consistent with the existing admin seam (ADR-0018).
