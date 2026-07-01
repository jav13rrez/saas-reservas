# Feature Specification: Email Notification Worker — Reliable Delivery in Production

**Feature Branch**: `005-worker-email`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "worker de email — bootstrap del proceso worker que consume la cola de
notificaciones y envía vía Brevo (adaptador ya existe, ADR-0020). El dispatcher hoy arma un mensaje
SMS cuando el cliente tiene teléfono, lo cual Brevo rechaza (sms-not-supported), dejando al cliente
sin notificación. Decisión de producto ya tomada: solo email, sin SMS. Cierra el MVP para que las
notificaciones de reservas (incluyendo las nuevas transiciones de estado de la feature 004: aprobar/
rechazar/completar/no-show) se envíen de verdad en producción."

## Context (non-normative)

Today a tenant customer never actually receives a booking notification in production, even though
all the pieces look built: `BrevoMessageProvider` is wired behind the `MessageProvider` port
(ADR-0020), and `dispatchBookingNotification` knows how to build a correct message for every booking
lifecycle event (`confirmed`, `cancelled`, `rescheduled`, `reminder`, `rejected`, `completed`,
`no_show` — the last three added by feature 004). But nothing in production ever calls that function:
it is exercised only by its own test. There is no running process that picks up a booking event and
turns it into an outbound message. Separately, the message builder currently chooses SMS whenever the
customer has a phone number on file, and Brevo (email-only, per the 2026-06-22 product decision)
rejects every SMS attempt with `sms-not-supported` — so any customer who happens to have a phone
number recorded gets nothing at all, not even by email.

This feature closes both gaps: every booking status change reliably reaches the customer by email,
and a real, running process is responsible for making that happen — not just a function that passes
its unit test.

Out of scope: SMS as a channel (deferred, paid Brevo/Twilio, a separate future decision); a
staff-facing UI to view/resend notification history (not requested, no existing gap-analysis entry
for it); reminder scheduling logic itself (the `reminder` event and its trigger timing already exist
conceptually in the dispatcher — this feature is about delivery, not about deciding when a reminder
should fire).

## Clarifications

None required — the product decision on channel (email-only, no SMS) was already made on 2026-06-22
and is treated as a hard constraint below, not re-opened. Failure-handling defaults (retry, audit) are
industry-standard choices with no meaningful alternative interpretation for this feature's scope; see
Assumptions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer is notified by email on every booking status change (Priority: P1)

As a tenant's customer, when the status of my booking changes — it gets approved, rejected, marked
completed, marked as a no-show, cancelled, or rescheduled — I receive an email telling me what
happened, regardless of whether I also have a phone number on file, so I always know the current
state of my appointment without having to check back manually.

**Why this priority**: This is the entire point of the feature. Without it, every notification-worthy
event silently produces nothing, which is the exact gap this feature exists to close. It is also the
direct consequence of feature 004 (booking lifecycle) actually being useful to end customers rather
than just to staff.

**Independent Test**: Trigger each of the seven supported booking events (confirmed, cancelled,
rescheduled, reminder, rejected, completed, no_show) for a customer who has both an email and a phone
number on file, and confirm an email is sent for every one of them, with no attempt to send SMS and
no event silently dropped.

**Acceptance Scenarios**:

1. **Given** a customer with both an email and a phone number on file, **When** their booking is
   approved, **Then** they receive an email notification (not SMS) with the correct booking details.
2. **Given** a customer with only an email on file (no phone), **When** their booking is completed or
   marked no-show, **Then** they receive the corresponding email (behavior unchanged from today).
3. **Given** any of the seven supported booking events fires, **When** the notification is dispatched,
   **Then** the outcome (sent or failed) is recorded so staff and future audits can see whether the
   customer was actually reached.

---

### User Story 2 - Notifications are delivered without requiring a human to trigger them (Priority: P1)

As the business owner, I want booking notifications to go out automatically as part of normal
operation — the moment a booking transitions, no admin action, no manual trigger, no dependency on a
test suite running — so that the notification promise made to customers is actually kept once the
system is live with real traffic.

**Why this priority**: Equal priority to US1: correct message content is worthless if nothing in
production ever calls the code that produces it. This is the "worker" half of "worker de email" —
today the notification logic exists only as a function invoked by its own test.

**Independent Test**: With the system running in its normal production-like mode (real database,
real message provider), perform a booking status transition through the normal application flow
(no direct function call, no test harness) and confirm the email arrives without any manual step.

**Acceptance Scenarios**:

1. **Given** the system is running in production-like mode, **When** a booking transitions through
   any of the seven supported events via the normal application flow, **Then** the corresponding
   email is sent without any operator intervention.
2. **Given** the message provider is temporarily unavailable (e.g., Brevo outage) when a notification
   is due, **When** the transient failure clears, **Then** the notification is still eventually
   delivered (not silently lost) within a bounded number of retries.
3. **Given** a notification permanently fails after exhausting retries (e.g., invalid email address),
   **When** that happens, **Then** the failure is recorded and visible to staff rather than
   disappearing without a trace.

### Edge Cases

- What happens when a customer has neither a valid email nor a phone number on file? The booking
  event still occurs; the system MUST record that no channel was available rather than crashing or
  silently skipping without a trace.
- What happens if the same booking event is delivered/retried more than once (e.g., a crash and
  restart mid-processing)? The customer MUST NOT receive duplicate emails for the same event.
- What happens if a customer's email address is malformed or the mail provider rejects it as invalid
  (permanent failure, not transient)? The system MUST stop retrying and record a permanent-failure
  outcome distinct from "not yet delivered."
- What happens during a deploy or restart of the worker process while notifications are pending? No
  pending notification may be lost — it must still be delivered after the process comes back up.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST deliver a customer-facing email notification for every one of the
  seven currently supported booking lifecycle events (confirmed, cancelled, rescheduled, reminder,
  rejected, completed, no_show) whenever that event occurs, without requiring any manual or
  test-only trigger.
- **FR-002**: The system MUST always use email as the delivery channel for booking notifications,
  regardless of whether the customer has a phone number on file. SMS MUST NOT be attempted.
- **FR-003**: The system MUST run as an ongoing, unattended process (or equivalent mechanism) that
  reacts to booking events as they happen in normal operation, not only when explicitly invoked by a
  test or an operator.
- **FR-004**: When a notification cannot be delivered due to a transient failure (e.g., provider
  temporarily unreachable), the system MUST retry a bounded number of times before giving up.
- **FR-005**: When a notification permanently fails (e.g., no usable contact channel, provider
  rejects the message as invalid) the system MUST record that outcome durably and MUST NOT silently
  drop the event.
- **FR-006**: The system MUST NOT send duplicate notification emails for the same booking event when
  the underlying process retries, restarts, or otherwise re-processes the same event.
- **FR-007**: The system MUST continue to notify customers correctly for the pre-existing events
  (confirmed, cancelled, rescheduled, reminder) exactly as today — this feature does not change their
  content or triggering conditions, only how reliably delivery happens and the channel decision.
- **FR-008**: Every attempted notification (delivered, retried, or permanently failed) MUST be tenant
  attributable and auditable, consistent with the project's existing requirement that operational
  workflows be eventful and auditable.
- **FR-009**: The delivery mechanism MUST NOT block or slow down the booking action itself (approving,
  rejecting, completing, etc.) that triggered the notification — the customer-facing operation
  completes independently of whether the email has been sent yet.

### Key Entities

- **Booking Notification Event**: A record that a specific booking transitioned to a state that
  requires notifying the customer (one of confirmed/cancelled/rescheduled/reminder/rejected/completed/
  no_show), tied to a tenant and a booking, and carrying the information needed to compose the
  message (customer contact info, service, provider, timing).
- **Notification Delivery Outcome**: The result of attempting to deliver a given notification event —
  sent, retrying, or permanently failed — including enough detail (timestamp, attempt count, failure
  reason where applicable) for staff/audit visibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the seven supported booking lifecycle events result in either a delivered email
  or a durably recorded permanent-failure outcome — none are silently dropped.
- **SC-002**: 0% of booking notifications are sent as SMS; every customer with a phone number on file
  still receives their notification by email instead of receiving nothing.
- **SC-003**: A booking status change performed through the normal application flow (not a test
  harness) results in an email reaching the customer without any operator action, in a real
  production-like run.
- **SC-004**: A transient provider outage does not cause permanent notification loss: once the
  provider recovers, previously-failed-but-retryable notifications are still delivered.
- **SC-005**: No customer receives more than one email for the same single booking event, even under
  process restarts or retries.

## Assumptions

- The seven booking events already defined in the current notification dispatcher (`confirmed`,
  `cancelled`, `rescheduled`, `reminder`, `rejected`, `completed`, `no_show`) are the complete set in
  scope; no new event types are introduced by this feature.
- "Bounded number of retries" follows standard practice for transactional email delivery (a small,
  finite number of attempts with backoff) — the exact count and backoff schedule are an implementation
  detail for the planning phase, not a product decision requiring sign-off here.
- Staff visibility into notification outcomes (FR-005/FR-008) can be satisfied by the project's
  existing audit/event mechanisms; a dedicated new admin screen is not required for this feature
  unless a future feature requests it.
- SMS remains explicitly out of scope, per the 2026-06-22 product decision recorded in `TECH_DEBT.md`;
  this feature does not revisit that decision.
- Validating delivery against the real Brevo service with a live account is an operational
  verification step for deployment, not a functional requirement of this spec — the feature must work
  correctly against the existing fake/real provider abstraction regardless of which is configured.
- Reminder timing/scheduling (when a `reminder` event should be raised) is unchanged and out of scope;
  this feature only concerns what happens once that event exists.
