# Feature Specification: Reservas — Ciclo de Estados y Pagos Manuales

**Feature Branch**: `004-reservas-ciclo-estados-pagos`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "reservas-ciclo-estados-pagos — máquina de estados completa de la reserva
(Pending → Approved → Rejected/Cancelled/Completed/No-show), estado por defecto configurable por
tenant (Approved, o Pending si el tenant requiere aprobación), transiciones que disparan
notificaciones, y registro de pagos manuales (método, estado pagado/parcial/no pagado, importe,
depósito, referencia de transacción, notas) — el tab Payment de la reserva. Cierra el MVP de negocio."

## Context (non-normative)

This feature implements decision #8 of ADR-0021 (six booking states, default Approved, configurable
per tenant) and the manual-payments half of the Bookings area (`menu-walkthrough-gap-analysis.md`,
área 2; `amelia-bookings-fine-grained.md`). Today the booking aggregate
(`packages/domain/src/bookings/booking.ts`) already has a state machine with
`pending → approved/rejected/expired` and `approved → canceled/rescheduled`, but it lacks the two
operational closing states a real operation needs — **Completed** and **No-show** — and the initial
status is hard-coded (admin bookings auto-approve; checkout creates pending then approves on
payment). Feature 003 added a per-tenant `requiresApproval` flag that nothing yet reads at creation
time. Payments today only exist through the gateway (cart/checkout); there is no way for staff to
record that a customer paid in **cash, card, or bank transfer** outside the gateway.

This feature closes those gaps: the full six-state lifecycle with staff actions, the configurable
default status, and a manual payment record attached to a booking.

Out of scope (deferred to their own features): bookings list search/filters/bulk actions/row actions
(`reservas-gestion-ux`); coupons and gift cards (`cupones`, `gift-cards-store-credit`); the Stripe
gateway refund/capture deepening (already done behind flags, ADR-0019); package usage tracking
(`paquetes`).

## Clarifications

### Session 2026-06-26

- Q: Are `Completed` and `No-show` reachable only from `Approved`? → A: Yes. An appointment must be
  approved before it can be marked completed or no-show; both are **terminal** states (no further
  transitions). `expired` and `rescheduled` (existing) are retained unchanged.
- Q: When the tenant requires approval, what status do new bookings get, and does it apply to the
  paid public checkout too? → A: New bookings are created **Pending** when `requiresApproval` is true,
  else **Approved**. For the **paid public checkout**, a successful payment still approves the booking
  (payment is the gating step there); `requiresApproval` governs the **no-charge** paths (admin
  "book on behalf" and any unpaid creation) — a Pending booking then awaits an explicit staff
  approve/reject. (This keeps the existing paid flow intact while honoring the flag where it applies.)
- Q: Is a manual payment a full ledger or a single record per booking? → A: For v1 it is a **single
  manual payment record per booking** (method, status Paid/Partial/Not-paid, amount in minor units,
  optional deposit, optional transaction reference, optional notes). Multiple partial payments / a
  full payment ledger is a documented later extension.
- Q: Does marking Completed/No-show require the appointment to have started? → A: No hard time gate in
  v1 (staff may close early in practice); the transition is allowed from Approved regardless of clock.
  A time-aware guard is a documented follow-up.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff moves a booking through its full lifecycle (Priority: P1)

As tenant staff, I move a booking through its real-world lifecycle — approve or reject a pending
request, and after the appointment mark it Completed or No-show — so that the booking list reflects
what actually happened and each change notifies the customer and is auditable.

**Why this priority**: The six-state lifecycle is the headline of this feature and the core of "ciclo
de estados". It extends the existing state machine with the two missing closing states and exposes
the staff actions. With only this story, an operation can already track every booking to a correct
terminal state.

**Independent Test**: Create an approved booking; mark it Completed and confirm the state, audit
record, and notification hook fire; on another booking mark No-show; attempt an invalid transition
(e.g. Completed → Approved) and confirm it is rejected without side effects.

**Acceptance Scenarios**:

1. **Given** an Approved booking, **When** staff mark it **Completed**, **Then** its status becomes
   Completed, a `booking.completed` event + audit record are emitted, and a notification is dispatched
   to the customer; Completed is terminal.
2. **Given** an Approved booking, **When** staff mark it **No-show**, **Then** its status becomes
   No-show, the corresponding event/audit/notification fire, and No-show is terminal.
3. **Given** a Pending booking, **When** staff **Approve** it, **Then** it becomes Approved (and may
   later be Completed/No-show/Cancelled); **When** staff **Reject** it instead, **Then** it becomes
   Rejected (terminal).
4. **Given** a booking in any terminal state (Rejected/Cancelled/Completed/No-show/Expired), **When**
   any further transition is attempted, **Then** it is rejected with no state change.
5. **Given** a booking marked Completed or No-show, **When** the booking list is read, **Then** the
   new status is shown.

---

### User Story 2 - New bookings honor the tenant's default-status policy (Priority: P2)

As a tenant administrator, I configure whether new bookings require approval (feature 003), and new
no-charge bookings are then created Pending (awaiting staff approval) or Approved accordingly, so that
businesses that screen requests get a queue and those that don't keep the one-step flow.

**Why this priority**: This connects the existing `requiresApproval` flag (003) to booking creation,
giving the lifecycle a real entry point. It depends on US1's states existing and the approve/reject
actions but is a thin, high-value wiring.

**Independent Test**: With `requiresApproval=false`, create an admin booking and confirm it is
Approved (slot occupied). With `requiresApproval=true`, create one and confirm it is Pending (and the
slot is held), then approve it and confirm it becomes Approved; reject another and confirm the slot is
freed.

**Acceptance Scenarios**:

1. **Given** a tenant with `requiresApproval=false`, **When** staff create a no-charge booking,
   **Then** it is created **Approved** and occupies the slot (current behavior preserved).
2. **Given** a tenant with `requiresApproval=true`, **When** staff create a no-charge booking,
   **Then** it is created **Pending**, the slot is held, and it appears in an approval queue.
3. **Given** a Pending booking, **When** staff approve it, **Then** it becomes Approved and remains
   occupying its slot; **When** staff reject it instead, **Then** it becomes Rejected and its slot
   occupancy is freed.
4. **Given** the paid public checkout, **When** a payment succeeds, **Then** the booking is approved
   as today (the `requiresApproval` flag does not block the paid path).

---

### User Story 3 - Staff record a manual payment against a booking (Priority: P3)

As tenant staff, I record that a customer paid outside the online gateway — cash, card terminal, or
bank transfer — capturing the method, whether it is fully or partially paid, the amount and any
deposit, an optional transaction reference, and notes, so that the booking reflects its real payment
state without forcing every payment through the gateway.

**Why this priority**: "Pagos manuales" completes the business MVP, but it is a new, self-contained
record that can ship after the lifecycle. It does not change the state machine; it annotates the
booking with payment information.

**Independent Test**: On a booking, record a manual payment (method=cash, status=paid, amount equal to
the total); read the booking and confirm the manual payment is reflected. Update it to partial with a
deposit; confirm the change persists and is audited. Submit an invalid amount (negative) and confirm
rejection.

**Acceptance Scenarios**:

1. **Given** a booking, **When** staff record a manual payment (method, status, amount), **Then** the
   payment is stored against the booking, the action is audited, and reading the booking reflects the
   payment method and status.
2. **Given** a booking with a manual payment, **When** staff update its status (e.g. Not-paid →
   Partial → Paid) or add a deposit/transaction reference/notes, **Then** the change persists and is
   audited.
3. **Given** an invalid manual payment (negative amount, or deposit greater than amount, or an unknown
   method/status), **When** staff submit it, **Then** it is rejected with no change.
4. **Given** a manual payment, **When** it is recorded, **Then** it is tenant-scoped and never visible
   to or modifiable from another tenant.

---

### Edge Cases

- **Invalid transition**: any transition not in the allowed set (e.g. Pending → Completed, or
  Completed → anything) is rejected without side effects (existing `InvalidBookingTransitionError`).
- **Reject frees the slot**: rejecting a Pending booking that holds occupancy must free that
  occupancy (like cancel), so the slot returns to availability.
- **Completed/No-show keep occupancy historical**: a completed or no-show booking is in the past; its
  occupancy is not "freed back" into future availability (the slot time has passed). No double-booking
  risk.
- **Manual payment vs gateway**: a booking paid through the gateway should not be overwritten by a
  manual record silently; the manual payment is a distinct annotation (v1 keeps them separate — the
  manual record is for no-gateway payments).
- **Cross-tenant isolation**: every lifecycle action and manual payment is tenant-scoped (RLS / tenant
  context); no path reads or mutates another tenant's booking or payment.
- **Deposit bounds**: a deposit greater than the amount, or a negative amount/deposit, is rejected.

## Requirements *(mandatory)*

### Functional Requirements

**Lifecycle states & transitions (US1)**

- **FR-001**: The booking state machine MUST support six states: Pending, Approved, Rejected,
  Cancelled, Completed, No-show (retaining the existing Expired and Rescheduled operational states).
- **FR-002**: The system MUST allow the transitions Approved → Completed and Approved → No-show; both
  Completed and No-show MUST be terminal.
- **FR-003**: The system MUST reject any transition not explicitly allowed, with no state change
  (e.g. Pending → Completed, or any transition out of a terminal state).
- **FR-004**: Each lifecycle transition (approve, reject, complete, no-show, cancel) MUST emit a
  domain event and an audit record identifying the acting staff member, and MUST trigger a customer
  notification dispatch for the customer-relevant transitions (approved, rejected, cancelled,
  completed, no-show).
- **FR-005**: Staff MUST be able to perform approve, reject, complete, and no-show actions on a
  booking through the admin API, gated by the existing admin staff-auth.

**Configurable default status (US2)**

- **FR-006**: New no-charge bookings MUST be created **Pending** when the tenant's `requiresApproval`
  is true, and **Approved** otherwise.
- **FR-007**: A Pending booking MUST hold its slot occupancy (so the slot is not offered twice while
  awaiting approval); approving keeps the occupancy, rejecting frees it.
- **FR-008**: The paid public checkout MUST continue to approve a booking on successful payment
  regardless of `requiresApproval` (the flag governs no-charge paths only).

**Manual payments (US3)**

- **FR-009**: Staff MUST be able to record a single manual payment against a booking with: method
  (one of Cash, Card, Bank Transfer, Other), status (Paid, Partial, Not-paid), amount (minor units,
  ≥ 0), optional deposit (minor units, ≥ 0 and ≤ amount), optional transaction reference, optional
  notes.
- **FR-010**: Staff MUST be able to update the manual payment of a booking; each create/update MUST be
  audited.
- **FR-011**: The system MUST reject an invalid manual payment (negative amount/deposit, deposit >
  amount, unknown method/status) with no change.
- **FR-012**: Reading a booking (admin) MUST reflect its manual payment method and status when one
  exists.

**Isolation & integrity (all)**

- **FR-013**: Every lifecycle action and manual payment MUST affect only the acting staff member's
  tenant (tenant isolation, constitution I).
- **FR-014**: Rejecting or cancelling a booking that holds occupancy MUST free that occupancy so the
  slot returns to availability; completing/no-showing MUST NOT free future occupancy (the slot is in
  the past).

### Key Entities *(include if data involved)*

- **Booking** (existing, extended): gains the `completed` and `no_show` statuses. No new attributes on
  the booking itself for the lifecycle; transitions follow the state machine.
- **Manual Payment** (new): a tenant-scoped record associated 1-to-1 with a booking. Attributes:
  method (Cash/Card/Bank Transfer/Other), status (Paid/Partial/Not-paid), amount (minor units),
  deposit (minor units, optional), currency (inherited from the booking), transaction reference
  (optional), notes (optional), timestamps. Distinct from the gateway cart/subpayment records.
- **Tenant** (existing): supplies `requiresApproval` (feature 003) that governs the default status.
- **Audit Record** (existing): every transition and manual-payment change is recorded with the staff
  actor, tenant-scoped.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can drive any booking to each terminal state (Rejected, Cancelled, Completed,
  No-show) and 100% of invalid transitions are rejected with no state change.
- **SC-002**: Every lifecycle transition produces an audit record and a notification dispatch for the
  customer-relevant transitions (verifiable for approved/rejected/cancelled/completed/no-show).
- **SC-003**: With `requiresApproval=true`, 100% of new no-charge bookings are created Pending and
  hold their slot; with it false, they are Approved — and the paid checkout path is unchanged.
- **SC-004**: Staff can record and update a manual payment on a booking; reading the booking reflects
  the method and status; 100% of invalid manual payments are rejected.
- **SC-005**: No lifecycle action or manual payment on one tenant's booking is reachable from another
  tenant's context.

## Assumptions

- **Extends the existing state machine and services**: the booking aggregate, `BookingService`
  transitions, `AdminBookingService`, occupancy recorder, and audit/event sink already exist (features
  001–003); this feature adds two states, two transition methods, the staff actions, the
  default-status wiring, and the manual-payment record. The availability engine is untouched.
- **Notifications**: the notification dispatch is the existing worker-side
  `booking-notification-dispatcher` shape (feature 001/Phase 8); this feature ensures the new
  transitions enqueue the appropriate notification. Actual email delivery depends on the (separate,
  pending) email worker bootstrap — out of scope here.
- **Manual payment single-record (resolved — see Clarifications)**: one manual payment per booking for
  v1; a multi-payment ledger and coupon/gift-card integration are later features.
- **Default-status scope (resolved — see Clarifications)**: `requiresApproval` governs no-charge
  creation; the paid checkout still approves on payment.
- **Persistence**: the manual payment is a new tenant-scoped table with RLS (constitution I); the two
  new booking statuses are values, needing no schema change to the bookings table beyond accepting the
  new status strings.
- **Authorization**: all actions require an admin staff session (ADR-0017), consistent with the other
  `/v1/admin/*` routes.
- **Design system**: any admin UI follows ADR-0008 (tokens, Lucide, Spanish, no emojis) and the
  data-source seam (ADR-0018) in both `demo` and `api` modes.
