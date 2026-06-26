# ADR-0024: Booking Lifecycle States And Manual Payments

**Date**: 2026-06-26
**Status**: accepted
**Deciders**: Project owner (javier@ikarum.com) + agent

## Context

ADR-0021 decision #8 resolved that the booking lifecycle moves from binary to six states
(Pending → Approved → Rejected/Cancelled/Completed/No-show), default Approved, configurable per
tenant. Feature 004 (`reservas-ciclo-estados-pagos`) implements that lifecycle and adds the
manual-payments half of the Bookings area (Amelia "Payment" tab): recording money taken outside the
online gateway.

The existing domain (`packages/domain/src/bookings/booking.ts`) already had a state machine with
`pending → approved/rejected/expired` and `approved → canceled/rescheduled`. Two operational closing
states (Completed, No-show) were missing, and the initial status was hard-coded. Feature 003 added a
per-tenant `requiresApproval` flag that nothing yet read at creation time. Payments existed only
through the gateway (cart/checkout).

## Decision

### 1. Two new terminal states, extending the existing machine

`completed` and `no_show` are added to `BookingStatus`. Allowed transitions become
`approved → canceled | rescheduled | completed | no_show`; both new states are **terminal**. The
existing `expired` and `rescheduled` operational states are retained unchanged. Invalid transitions
keep throwing `InvalidBookingTransitionError` (mapped to HTTP 409). Completing or no-showing a booking
does **not** free its slot occupancy (the appointment is in the past); reject and cancel **do** free
occupancy.

### 2. Configurable default status driven by `requiresApproval`

No-charge booking creation (`AdminBookingService`) reads the tenant's `requiresApproval` (feature 003,
ADR-0023): when true the booking is created **Pending** (occupancy still recorded so the slot is held)
and awaits an explicit staff approve/reject; when false it is created and approved as before. The
**paid public checkout still approves on successful payment** regardless of the flag — payment is the
gating step there. This keeps the existing paid flow intact while honoring the flag on the no-charge
paths.

### 3. Manual payment as a separate one-per-booking record

A new tenant-scoped `manual_payments` table (migration `012`, RLS, `UNIQUE (tenant_id, booking_id)`)
holds a single staff-entered payment per booking: method (`cash`/`card`/`bank_transfer`/`other`),
status (`paid`/`partial`/`not_paid`), amount, deposit (0..amount), currency, optional transaction
reference and notes. It is **distinct from the gateway cart/subpayment tables** so reconciliation is
never polluted. Validation (`validateManualPayment`) is pure domain; the service upserts and audits.

## Alternatives Considered

- **A generic `PATCH /status` endpoint** instead of explicit approve/reject/complete/no-show routes:
  rejected — each action has a distinct occupancy side-effect (reject frees, complete does not), and
  explicit routes keep those unambiguous while the domain still guards the transition.
- **Reusing the gateway subpayment tables for manual payments**: rejected — conflates gateway
  settlement (reconcilable against Stripe) with staff-entered cash/transfer records, breaking the
  reconciliation invariants (constitution II/V).
- **A full manual-payment ledger (multiple partial payments)**: deferred — one record per booking is
  enough for v1; a ledger and coupon/gift-card integration are later features.
- **A hard time gate on Completed/No-show (must be past start)**: deferred — staff may close early in
  practice; a time-aware guard is a documented follow-up.

## Consequences

- The booking list can reflect every real terminal state; each transition emits an event + audit and
  enqueues a customer notification for the customer-relevant transitions.
- Tenants that screen requests get a Pending queue; others keep the one-step flow. The flag is set on
  the tenant settings surface (feature 003).
- New domain table `manual_payments` (migration `012`) must be applied in production (TECH_DEBT).
- Remaining slice (this feature): the admin console UI — per-row status actions and the Payment
  section on the Reservas screen, including extending the demo store's simplified two-state booking
  model to the six states. Tracked as T012/T013.
