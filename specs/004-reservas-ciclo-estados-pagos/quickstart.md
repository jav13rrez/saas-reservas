# Quickstart & Acceptance: Reservas — Ciclo de Estados y Pagos Manuales

**Feature**: 004 | **Date**: 2026-06-26

Scenarios mapped to the user stories; each is covered by an automated test.

## S1 — Complete / No-show (US1, SC-001/002)

1. Create an approved booking; `POST /v1/admin/bookings/:id/complete` → status `completed`.
2. Completing again → `409 invalid-transition` (terminal). Same for `no-show`.

## S2 — Invalid transition rejected (US1, SC-001)

1. On a pending booking, attempt `complete` → `409`; no state change.

## S3 — Configurable default status (US2, SC-003)

1. With `requiresApproval=false`, create a no-charge booking → `approved`, slot occupied.
2. Set `requiresApproval=true` (PATCH /v1/admin/settings); create → `pending`, slot still held.
3. `approve` → `approved`. On another pending, `reject` → `rejected` and its slot returns to availability.

## S4 — Paid checkout unaffected (US2, SC-003)

1. The public checkout still approves on successful payment regardless of `requiresApproval`.

## S5 — Manual payment (US3, SC-004)

1. `PUT /v1/admin/bookings/:id/payment` `{ method, status, amount, deposit, currency }` → `200`.
2. `GET .../payment` reflects method/status/deposit.
3. Invalid (deposit > amount, negative amount, unknown method/status) → `400` with the error code.

## S6 — Cross-tenant isolation (all, SC-005)

1. A manual payment recorded for tenant A's booking is not readable under tenant B's context.

## Acceptance status

| Scenario | Story | SC | Status | Covered by |
|----------|-------|----|--------|------------|
| S1 | US1 | SC-001/002 | validated | `admin-bookings-lifecycle.test.ts` |
| S2 | US1 | SC-001 | validated | `admin-bookings-lifecycle.test.ts` + unit |
| S3 | US2 | SC-003 | validated | `admin-bookings-lifecycle.test.ts` |
| S4 | US2 | SC-003 | covered | existing checkout suite (feature 001/002) unchanged |
| S5 | US3 | SC-004 | validated | `admin-bookings-lifecycle.test.ts` + `manual-payment.test.ts` |
| S6 | all | SC-005 | validated | `manual-payment.test.ts` |

> UI acceptance (per-row status actions + Payment section on the Reservas screen) is the remaining
> slice T012/T013; the API/domain are complete and validated.
