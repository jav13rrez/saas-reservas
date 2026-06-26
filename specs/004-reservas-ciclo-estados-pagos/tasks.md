---
description: "Task list for feature 004 — Reservas: ciclo de estados y pagos manuales"
---

# Tasks: Reservas — Ciclo de Estados y Pagos Manuales

**Input**: Design documents from `/specs/004-reservas-ciclo-estados-pagos/`

**Prerequisites**: spec.md, plan.md

**Tests**: Included (constitution Delivery Workflow). Tests first where practical.

**Organization**: Grouped by user story (US1 lifecycle, US2 default status, US3 manual payments).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational (domain)

- [ ] T001 [US1] Add `completed` and `no_show` to `BookingStatus` and `TRANSITIONS`
  (`approved → canceled|rescheduled|completed|no_show`; both new states terminal) in
  `packages/domain/src/bookings/booking.ts`. Unit test first
  (`tests/unit/bookings/booking-state-machine.test.ts` extended): new transitions allowed, terminal
  guards, invalid transitions rejected.
- [ ] T002 [US3] New `packages/domain/src/payments/manual-payment.ts`: `ManualPaymentMethod`,
  `ManualPaymentStatus`, `ManualPayment` types + `validateManualPayment` (method/status enums, amount
  ≥ 0, deposit ≥ 0 and ≤ amount). Unit test (`tests/unit/payments/manual-payment.test.ts`).

## Phase 2: US1 — Lifecycle (P1)

- [ ] T003 [US1] `BookingService.complete()` + `noShow()` in
  `services/api/src/application/bookings/booking-service.ts` (transition + event + audit), mirroring
  approve/reject/cancel.
- [ ] T004 [US1] Admin routes `POST /v1/admin/bookings/:id/{approve,reject,complete,no-show}` in
  `availability-routes.ts` (admin-gated). Reject frees occupancy (`releaseBookingOccupancy`);
  approve/complete/no-show do not. `AdminBookingService` gains `approve/reject/complete/noShow`
  helpers wrapping `BookingService` + occupancy side-effects.
- [ ] T005 [US1] Notification dispatch: add `completed`/`no_show` message builders to
  `services/worker/src/jobs/booking-notification-dispatcher.ts`.
- [ ] T006 [US1] Integration test `tests/integration/bookings/lifecycle.test.ts`: complete/no-show
  audit; reject frees occupancy; invalid transition rejected.

## Phase 3: US2 — Configurable default status (P2)

- [ ] T007 [US2] Thread `requiresApproval` into `AdminBookingService.createBooking`: when true, stop
  after `createPendingBooking` (status Pending, occupancy held); when false keep create-then-approve.
  Needs a tenant settings read (inject `tenantAdmin`/lookup).
- [ ] T008 [US2] E2E test `tests/e2e/admin-bookings-lifecycle.test.ts`: with requiresApproval=true →
  create yields Pending; approve → Approved; reject → Rejected + slot freed; with false → Approved.

## Phase 4: US3 — Manual payments (P3)

- [ ] T009 [US3] Migration `infra/postgres/012-manual-payments.sql` (RLS) + `manualPayments` in
  `schema.ts`.
- [ ] T010 [US3] `ManualPaymentRepository` port + in-memory + Drizzle adapters; `ManualPaymentService`
  (`upsertForBooking` audited, `getForBooking`).
- [ ] T011 [US3] Routes `GET`/`PUT /v1/admin/bookings/:id/payment` (admin-gated). Integration test
  `tests/integration/payments/manual-payment.test.ts` (upsert, invalid rejected, cross-tenant).

## Phase 5: Admin console (US1+US3 UI)

- [ ] T012 [US1] Reservas screen: per-row status actions (Aprobar/Rechazar/Completar/No-show) through
  the seam (`source/bookings.ts` + demo store transitions) in both modes.
- [ ] T013 [US3] Reservas screen: Payment section (método/estado/importe/depósito/referencia/notas)
  via `source/booking-payment.ts` + demo store get/upsert + `app/api/bookings/[id]/payment/route.ts`.

## Phase 6: Polish

- [ ] T014 [P] ADR-0024 (booking lifecycle states + manual-payment model).
- [ ] T015 [P] Quickstart + acceptance; mark tasks.md complete.
- [ ] T016 Full gate green (typecheck/lint/format/test + apps build); update PROGRESS/HANDOFF/TECH_DEBT
  (migration 012 pending in prod).
