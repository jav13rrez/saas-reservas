# ADR-0021: Cross-Cutting Product Decisions From The Admin Walkthrough

**Date**: 2026-06-24
**Status**: accepted
**Deciders**: Project owner (javier@ikarum.com) + agent

## Context

The area-by-area walkthrough of the admin console
(`docs/analysis/menu-walkthrough-gap-analysis.md`, 2026-06-23) surfaced **eight
cross-cutting decisions** that span multiple sidebar areas and the canonical
domain. They blocked clean per-area specs: each growth feature
(`/speckit-specify`) needs these answered first so the specs do not contradict
one another (e.g. category modelling touches Services, Bookings, filters and the
public widget at once).

This ADR records the resolution of all eight so that the next round of
feature specs can be seeded consistently. It does not implement anything; each
decision feeds one or more future Spec-Kit features listed in the gap-analysis
"Catálogo de candidatos a feature".

## Decision

### 1. Category as a first-class entity

A service **Category** becomes a first-class entity (name, color, icon, display
order, booking count), replacing the current free-text `category` string. It is
transversal: Services, Bookings filters, the booking modal, and the public
widget all reference it. A migration must map existing free-text values onto
created Category rows.

→ Feature: `categorias-entidad` (and `servicios-edicion-ux`).

### 2. Online/virtual services and locations — deferred to post-MVP

Modelling virtual/hybrid locations (location `type` Physical/Virtual/Hybrid +
meeting link) and an "online" service flag is **deferred until after the MVP
deployment**. The MVP targets in-person bookings; the virtual path pulls in the
meetings integration (Zoom/Meet) and added UI complexity that are not needed to
launch. Registered as gap-analysis "Decisión pendiente #5".

### 3. Group booking and quantity partition — remain deferred

`shared / per-service / per-location` quantity partition and group booking
(one slot serving multiple people) **remain deferred** (already deferred in
ADR-0016). The resource hub already supports adding them when a real tenant
demand appears. No MVP impact. Capacity stays "1 unit per booking".

→ Feature (when revisited): `recursos-cantidad-avanzada`.

### 4. Cancellation/reschedule policies and currency live at the tenant level

Booking time policies (cancellation, reschedule, lead time) and the tenant's
**currency** live **globally per tenant**, persisted in a new `tenant_settings`
record. Per-location override is a documented **future extension**, not built
now. The policy engine itself already exists (User Story 3); this only fixes the
configuration point.

→ Feature: `tenant-settings`.

### 5. Separate "Facturación (SaaS)" from "Finanzas (negocio)" in the menu

The sidebar splits the two conflated concepts:

- **Facturación (SaaS)** — what the platform charges the tenant (plan, feature
  flags, usage quotas). Backend exists (`packages/domain/src/billing`); only UI
  is missing. → `saas-billing-plan-ui`.
- **Finanzas (negocio)** — the tenant's money against ITS own customers
  (payments, refunds, receipts, coupons, gift cards / store credit). →
  `finanzas-pagos`, `cupones`, `gift-cards-store-credit` (new domains).

### 6. The four "menu-less" Amelia areas fold into Configuración

Notifications, Custom Fields, and Integrations become **tabs inside
Configuración (Settings)**, not top-level sidebar entries. **Customize** (widget
branding/appearance) attaches to the public widget configuration. This keeps the
sidebar lean for the MVP; any of them can graduate to a top-level area later if
its surface grows.

### 7. Platform/superadmin is a separate surface; provider links to a staff login

- A **separate platform surface** carries **superadmin auth**. The current
  `/operations` view (cross-tenant, today unprotected inside `apps/admin`) and
  tenant provisioning (`POST /v1/platform/tenants`, today open) move behind it.
  This closes the largest security gap found in the walkthrough.
- **Provider** (a catalog entity) stays **separate** from `staff_accounts`
  (login, ADR-0017) but becomes **linkable**: a staff account may carry an
  optional `providerId`, so a provider who logs in is bound to their catalog
  record (staff portal). They are not merged into one entity.

→ Feature: `plataforma-superadmin` (next spec to open per HANDOFF).

### 8. Six booking states, default Approved, configurable

The booking lifecycle moves from binary (confirmed/cancelled) to **six states**:
`Pending → Approved → Rejected / Cancelled / Completed / No-show`. State
transitions fire notifications. The **default status on creation is `Approved`**
(so the current flow does not break), **configurable per tenant** (a tenant may
choose `Pending` to require manual approval). The domain already has a booking
state machine (`packages/domain/src/bookings/booking.ts`) to extend.

→ Feature: `reservas-ciclo-estados-pagos`.

## Alternatives Considered

- **Category as free text (status quo):** simpler now, but blocks filters,
  color/order, and forces a later migration anyway. Rejected.
- **Policies/currency per location or per service from the start:** more
  flexible for multi-country chains, but premature complexity for a
  not-yet-launched MVP. Deferred as a future override.
- **Keep Operaciones inside admin behind a superadmin role:** closes the hole
  faster but conflates platform and tenant concerns; rejected in favour of a
  clean platform surface (the owner's stated objective).
- **Binary booking status:** cannot express no-show / completed / approval;
  rejected.
- **Four Amelia areas as top-level sidebar entries:** recognised but rejected
  for MVP to avoid navigation bloat before the content exists.

## Consequences

- The next Spec-Kit features can be opened without re-litigating these choices.
  Recommended order (HANDOFF): `plataforma-superadmin` → `tenant-settings` →
  `reservas-ciclo-estados-pagos`.
- New domain work implied: Category entity + migration (#1), `tenant_settings`
  (#4, #8 default-status, #5 sender/activation later), six-state lifecycle (#8),
  superadmin auth surface + `staff.providerId` (#7), and the new finance domains
  coupons/gift-cards (#5).
- Deferred and explicitly **not** MVP work: online/virtual (#2), group
  booking/quantity partition (#3), per-location policy override (#4).
- The gap-analysis "Decisiones transversales surgidas" section is updated to mark
  all eight resolved and point here.
