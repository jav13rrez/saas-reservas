# Phase 0 Research: Email Notification Worker

**Date**: 2026-07-01 | **Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

The spec required no clarification (Clarifications: "None required"). This document records the
technical decisions made in `plan.md`, their rationale, and the alternatives considered — the Phase 0
research that grounds them.

## D1 — Delivery mechanism: outbox relay + BullMQ, not direct enqueue or a bare poller

- **Decision**: `domain_events` (already an append-only outbox per `infra/postgres/002-domain.sql`)
  stays the source of truth. A new relay polls it for notification-relevant event types and enqueues
  a BullMQ job per event (`jobId = eventId`); a BullMQ consumer in a new
  `services/worker/src/main.ts` performs the actual send and records the outcome.
- **Rationale**: `docs/adr/0004-queues-bullmq.md` already decided BullMQ for background jobs and
  explicitly flagged that enqueue-at-the-call-site is not transactional with the booking write, so
  "critical transitions must use the outbox/audit-event pattern... to guarantee delivery" — a
  follow-up the ADR left undocumented. `domain_events` already satisfies the transactional half (it's
  written in the same transaction as the booking state change, via `DrizzleEventSink`); this feature
  only needed to add the relay that reads it.
- **Alternatives considered**:
  - *Enqueue directly from `BookingService`/`AdminBookingService` at the moment of transition*:
    simpler, but reproduces exactly the failure mode ADR-0004 warned about — a crash between the DB
    commit and the enqueue call silently loses the notification. Rejected.
  - *A hand-rolled `setTimeout` poller instead of BullMQ*: avoids the new dependency, but
    re-implements retry/backoff, dedup, and delayed/repeatable jobs that BullMQ already provides and
    that ADR-0004 already chose. Rejected — would also require a persistent idempotency store to be
    safe across restarts/replicas (see D3), which BullMQ already is.
  - *Postgres `LISTEN`/`NOTIFY` instead of polling*: lower latency, but adds a second connection
    lifecycle (persistent listener) with no test-suite precedent in this codebase; polling on a short
    interval is simple, already the constitution's stated pattern ("asynchronous workers"), and
    latency of a few seconds is acceptable for booking notifications. Rejected for v1; revisit if
    latency becomes a real complaint.

## D2 — Outcome tracking: dedicated `notification_deliveries` table, not a status column on `domain_events`

- **Decision**: New tenant-scoped table, one row per relayed event (`event_id` unique), status
  `queued|sent|failed`, attempts, last error.
- **Rationale**: `domain_events` is explicitly documented as a shared, append-only outbox — any future
  consumer (outbound webhooks, calendar sync) may need to read the same events independently. Coupling
  it to one consumer's processing state (a single status column) would force every future consumer to
  either share that state machine or bolt on more ad-hoc columns. A dedicated table keeps this
  consumer's state private to it, and directly answers the spec's staff-visibility requirement
  (FR-005/FR-008) with a queryable per-event outcome, not just a relay cursor.
- **Alternatives considered**:
  - *Single "last relayed event" cursor row*: minimal storage, but cannot answer "did event X's
    notification reach the customer, or did it permanently fail and why" — exactly what FR-005/FR-008
    require. Rejected.
  - *Status column on `domain_events`*: couples the shared outbox to this one consumer. Rejected.

## D3 — Retry/dedup: BullMQ's own mechanism, not `job-runner.ts`'s `JobIdempotencyStore`

- **Decision**: Use BullMQ's built-in `jobId`-based dedup and configured retry/backoff for this job
  type; leave `services/worker/src/infrastructure/jobs/job-runner.ts` (T080) untouched for the job
  types that already use it.
- **Rationale**: `job-runner.ts`'s `JobIdempotencyStore` port only has an `InMemoryJobIdempotencyStore`
  implementation — it does not survive a process restart and is not safe across multiple worker
  replicas, which is exactly the failure mode the spec's edge cases rule out ("no pending notification
  may be lost... across process restart"). BullMQ is Redis-backed and already replica-safe; adopting
  it directly avoids building a second persistent idempotency store that would just duplicate what
  BullMQ already does.
- **Alternatives considered**:
  - *Build a Postgres-backed `JobIdempotencyStore` and keep using `job-runner.ts`*: possible, but adds
    a second persistence mechanism (idempotency table) doing the same job BullMQ's `jobId` dedup and
    Redis-backed job state already do. Rejected as redundant.

## D4 — Fixing the SMS branch is independent and trivial

- **Decision**: `buildMessage` in `booking-notification-dispatcher.ts` drops its `customerPhone`
  branch entirely and always returns an `email` message.
- **Rationale**: The channel decision (email-only, no SMS) was already made as a product decision on
  2026-06-22 (`TECH_DEBT.md`). This is a pure function change with no architectural weight; it does
  not depend on D1-D3 and can land independently of the relay/consumer work.
- **Alternatives considered**: None meaningful — the product decision leaves no other reasonable
  reading. A "try SMS, fall back to email on `sms-not-supported`" variant was considered but rejected:
  it would silently depend on a specific error code from one provider (`BrevoMessageProvider`) to
  behave correctly, which is fragile and unnecessary now that SMS is out of scope entirely.
