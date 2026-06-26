# Implementation Plan: Reservas — Ciclo de Estados y Pagos Manuales

**Branch**: `004-reservas-ciclo-estados-pagos` | **Date**: 2026-06-26 | **Spec**: [spec.md](./spec.md)

## Summary

Extend the existing booking state machine with the two missing closing states (**Completed**,
**No-show**) and the staff actions to reach them; wire booking creation to honor the per-tenant
`requiresApproval` flag (feature 003) so no-charge bookings start Pending or Approved; and add a
single **manual payment** record per booking (method/status/amount/deposit/reference/notes) for
payments taken outside the gateway. The availability engine, the paid checkout flow, and tenant
isolation are untouched.

Technical approach: add `completed`/`no_show` to the domain `BookingStatus` and the `TRANSITIONS`
table (`approved → completed | no_show`, both terminal); add `complete()`/`noShow()` to
`BookingService`; expose `POST /v1/admin/bookings/:id/{approve,reject,complete,no-show}` (or a single
`PATCH .../status`) behind staff-auth, with reject/cancel freeing occupancy; thread `requiresApproval`
into `AdminBookingService.createBooking` (skip the auto-approve when true); and add a new tenant-scoped
`manual_payments` table + domain validation + `ManualPaymentService` + admin routes. Admin UI for the
status actions and the Payment tab goes through the existing data-source seam (ADR-0018).

## Technical Context

**Language/Version**: TypeScript 5.x — unchanged.

**Primary Dependencies**: Fastify (API), Drizzle + SQL migrations (persistence), Next.js admin
console, `packages/ui` + lucide-react. No new third-party dependency.

**Storage**: PostgreSQL. New tenant-scoped table `manual_payments` (RLS via `apply_tenant_rls`),
migration `012-manual-payments.sql`. The bookings table needs no schema change — `status` already
stores arbitrary status strings; the two new values are accepted by the domain.

**Testing**: Unit (state machine: new transitions + terminal guards; manual-payment validation).
Integration (approve/reject/complete/no-show audit + occupancy free on reject; default-status by
`requiresApproval`; manual payment create/update + invalid rejected + cross-tenant isolation; Drizzle
self-skips without Postgres). E2E over HTTP (admin status actions; create-pending-when-required).

**Project Type**: Modular monolith — extends the existing API + admin app; no new service.

**Constraints**: Booking correctness (constitution II) — Completed/No-show never free future occupancy
and never relax availability; reject/cancel free occupancy. Every transition + manual-payment change
is audited (V). All actions admin-gated and tenant-scoped (I).

## Constitution Check

- **I. Tenant Isolation** — PASS. `manual_payments` is tenant-scoped with RLS; every action runs in the
  resolved tenant's context; no cross-tenant read/write.
- **II. Booking Correctness** — PASS. The state machine only *adds* terminal transitions; Completed/
  No-show are past-facing and never re-open a slot; reject/cancel free occupancy exactly as cancel does
  today; availability engine untouched.
- **III. Domain Engine Before Delivery** — PASS. States/transitions and manual-payment validation are
  pure domain; services orchestrate; routes + UI are delivery channels.
- **IV. Integrations Isolated** — PASS (n/a; manual payment is an internal record, not a gateway call).
- **V. Eventful & Auditable** — PASS. Every transition and manual-payment create/update emits a domain
  event + audit record; customer-relevant transitions enqueue a notification.
- **VI. Configurable Vertical Core** — PASS. The default-status is tenant configuration (requiresApproval).

No violations.

## Architecture Decisions

### 1. State machine extension (US1)

- `BookingStatus` gains `completed` and `no_show`. `TRANSITIONS`:
  `approved → [canceled, rescheduled, completed, no_show]`; `completed`/`no_show` → `[]` (terminal).
  Pending/rejected/expired/canceled/rescheduled unchanged.
- `BookingService.complete()` and `noShow()` mirror the existing `approve/reject/cancel` (transition →
  event `booking.completed`/`booking.no_show` → audit). Notification dispatch is enqueued for
  customer-relevant transitions (reuse the existing `booking-notification-dispatcher` event types;
  add `completed`/`no_show` message builders).

### 2. Admin lifecycle actions (US1) + default status (US2)

- Routes under the existing staff-auth admin gate: `POST /v1/admin/bookings/:id/approve`,
  `.../reject`, `.../complete`, `.../no-show` (cancel already exists). Reject and cancel free
  occupancy (`releaseBookingOccupancy`); approve/complete/no-show do not.
- `AdminBookingService.createBooking` reads the tenant's `requiresApproval` (via `TenantAdminService.
  getSettings` or a tenant lookup): when true it stops after `createPendingBooking` (status Pending,
  occupancy still recorded so the slot is held); when false it keeps the current create-then-approve.
- A `reject` on a Pending admin booking frees occupancy (the slot returns to availability).

### 3. Manual payments (US3)

- New `manual_payments` table (`012-manual-payments.sql`, RLS): `id`, `tenant_id`, `booking_id`
  (unique — one per booking), `method`, `status`, `amount`, `deposit`, `currency`, `transaction_ref`,
  `notes`, timestamps. Mirrored in `schema.ts`.
- Domain validation (`packages/domain/src/payments/manual-payment.ts`): method ∈
  {cash,card,bank_transfer,other}, status ∈ {paid,partial,not_paid}, amount ≥ 0, deposit ≥ 0 and ≤
  amount. Pure `validateManualPayment`.
- `ManualPaymentService` (application) + `ManualPaymentRepository` port, in-memory + Drizzle adapters;
  `upsertForBooking` (create or update, audited), `getForBooking`.
- Routes `GET /v1/admin/bookings/:id/payment` and `PUT /v1/admin/bookings/:id/payment` (admin-gated).

### 4. Admin console (ADR-0018)

- Reservas screen: per-row status actions (Aprobar/Rechazar/Completar/No-show) and a Payment section
  (método, estado, importe, depósito, referencia, notas). Seam modules extend `source/bookings.ts`
  with the status transitions and a new `source/booking-payment.ts`; demo store gains the transitions
  + manual-payment get/upsert. Design tokens, Lucide, Spanish, no emojis.

## Project Structure

```text
packages/domain/src/bookings/booking.ts            # + completed/no_show + transitions
packages/domain/src/payments/manual-payment.ts     # NEW: types + validateManualPayment
packages/persistence/src/schema.ts                 # + manualPayments table
packages/persistence/src/repositories/...           # NEW DrizzleManualPaymentRepository
services/api/src/application/bookings/booking-service.ts        # + complete/noShow
services/api/src/application/bookings/admin-booking-service.ts  # honor requiresApproval; reject frees occupancy
services/api/src/application/payments/manual-payment-service.ts # NEW
services/api/src/api/availability-routes.ts        # admin status + payment routes
services/api/src/infrastructure/memory/...          # in-memory manual-payment store
infra/postgres/012-manual-payments.sql             # NEW table + RLS
apps/admin/src/features/bookings + server/source/... # status actions + Payment section (seam)
docs/adr/0024-booking-lifecycle-and-manual-payments.md  # records states + manual-payment model
```

**Structure Decision**: No new app/service. Extends existing domain/application/delivery layers; one
new tenant-scoped table.

## Test Plan

| Level | Cases | Runs against |
|-------|-------|--------------|
| Unit | new transitions (approved→completed/no_show), terminal guards, invalid transitions; `validateManualPayment` accept/reject | always |
| Integration | approve/reject/complete/no-show emit audit; reject frees occupancy; default status by requiresApproval (pending vs approved); manual payment create/update + invalid rejected + cross-tenant isolation | in-memory always; Drizzle self-skips |
| E2E (HTTP) | admin lifecycle actions over HTTP; create-pending-when-required then approve; manual payment PUT/GET | always (in-memory app) |

## Complexity Tracking

| Decision | Why | Alternative rejected |
|----------|-----|----------------------|
| New `manual_payments` table (1-per-booking) instead of reusing the gateway subpayment tables | Manual payments are a different concept (no gateway, staff-entered, method/notes) and must not pollute reconciliation | Overloading the cart/subpayment model conflates gateway settlement with manual entry and breaks reconciliation invariants |
| Four explicit action routes (approve/reject/complete/no-show) instead of one generic `PATCH status` | Each maps to a distinct domain method with its own occupancy side-effect (reject frees, complete does not); explicit routes keep the side-effects unambiguous | A generic status PATCH would have to branch on the target and re-implement the guards the domain already encodes |
