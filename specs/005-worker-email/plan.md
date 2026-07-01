# Implementation Plan: Email Notification Worker — Reliable Delivery in Production

**Branch**: `005-worker-email` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

## Summary

Close two gaps left in place since feature 004: (1) the notification builder picks SMS whenever a
customer has a phone on file, and Brevo (email-only) rejects it, leaving that customer with nothing;
(2) `dispatchBookingNotification` is a correct, tested, pure function that **nothing in production
ever calls** — there is no running process, no queue, and no bootstrap for `services/worker`.

Technical approach: fix `buildMessage` to always emit `email` (drop the SMS branch entirely). For
delivery, implement the outbox-relay pattern that ADR-0004 already mandated but never built: a new
tenant-scoped `notification_deliveries` table tracks, per domain event, whether its notification was
queued/sent/failed; a **relay** polls `domain_events` for unprocessed booking-notification events and
enqueues a BullMQ job per event (`jobId = eventId`, giving enqueue-side dedup); a **BullMQ consumer**
in a new `services/worker/src/main.ts` bootstrap calls `dispatchBookingNotification` with BullMQ's
built-in retry/backoff, and updates the delivery row to `sent` or `failed`. This satisfies "at least
once, exactly-once-observed" delivery without making the booking action itself wait on the email
provider (FR-009), and finally documents the outbox pattern ADR-0004 flagged as a follow-up (a new
ADR-0025 records it).

## Technical Context

**Language/Version**: TypeScript 5.x — unchanged.

**Primary Dependencies**: `bullmq` (new — decided by ADR-0004, never installed until now) + `ioredis`
(already a workspace dependency, already configured with `maxRetriesPerRequest: null` in
`services/api/src/main.ts`, which is the option BullMQ requires — the Redis client was evidently
provisioned with this in mind). Drizzle + SQL migrations for the new table. No other new dependency.

**Storage**: PostgreSQL. New tenant-scoped table `notification_deliveries` (RLS), migration
`013-notification-deliveries.sql`. No change to `domain_events` (the existing outbox stays
append-only and untouched, per its own "Outbox + audit... Append-only" comment in
`infra/postgres/002-domain.sql`).

**Testing**: Unit (SMS branch removed from `buildMessage`; relay's "which events are still pending"
selection logic; consumer's success/failure → delivery-row transition). Integration (end-to-end
against in-memory outbox + fake queue: event written → relayed → delivered → row marked `sent`;
provider failure → retried → eventually `failed` and recorded; duplicate relay run does not
double-enqueue; Drizzle-backed `notification_deliveries` self-skips without Postgres, consistent with
the rest of the suite). No E2E over real Brevo/Redis (out of scope per spec Assumptions — that's an
operational deployment check, not a functional test).

**Project Type**: Modular monolith — adds the first real bootstrap to the existing `services/worker`
package; no new service.

**Constraints**: Booking correctness (constitution II) is unaffected — this feature only observes
booking events after the fact, it never changes booking/availability state. Every delivery attempt is
tenant-attributable and auditable (V). The booking action that triggers a notification must return to
its caller without waiting for the email to actually send (FR-009) — relay and consumer run
out-of-band from the request/response cycle that recorded the domain event.

## Constitution Check

- **I. Tenant Isolation** — PASS. `notification_deliveries` is tenant-scoped with RLS; the relay reads
  `domain_events` tenant-scoped (existing RLS already applies); BullMQ job payloads carry `tenantId`
  per ADR-0004 ("every job payload carries `tenant_id`"); queue names stay platform-level, not
  per-tenant, per the same ADR.
- **II. Booking Correctness** — PASS / not applicable. This feature is read-only with respect to
  booking/availability state — it observes already-committed domain events and never re-opens,
  double-books, or mutates a booking.
- **III. Domain Engine Before Delivery Channels** — PASS. `buildMessage`/`dispatchBookingNotification`
  remain framework-agnostic domain/application code; the BullMQ consumer and relay poller in
  `services/worker/src/main.ts` are the delivery-channel plumbing around that existing logic, not a
  reimplementation of it.
- **IV. Enterprise Integrations Are Isolated Adapters** — PASS. No change to the `MessageProvider`
  port or `BrevoMessageProvider`; this feature only ensures something actually calls the existing
  adapter boundary in production.
- **V. Operational Workflows Are Eventful And Auditable** — PASS, and this feature is what makes this
  principle actually true for notifications end-to-end: today a booking transition emits a domain
  event (already true, feature 004 and earlier), but nothing observable records whether the customer
  was ever told. `notification_deliveries` closes that gap with a durable, queryable outcome per
  event.
- **VI. Configurable Vertical Core** — PASS / not applicable. No vertical-specific behavior introduced.

No violations. Redis namespacing: BullMQ queue key stays platform-level (`booking-notifications`,
per ADR-0004's "Queue names are platform-level, tenant identity lives in payloads and lock keys");
no new Redis key pattern is introduced beyond what ADR-0004 already scoped. Credential isolation:
unchanged — `BREVO_API_KEY`/`MESSAGING_FROM_EMAIL` are read exactly as `resolveMessageProvider`
already reads them today; no new secret is introduced.

## Project Structure

### Documentation (this feature)

```text
specs/005-worker-email/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output (internal job/queue contract, no public HTTP API)
└── tasks.md              # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
services/worker/
├── package.json                                   # + bullmq, ioredis dependencies
├── src/
│   ├── main.ts                                     # NEW: composition root — in-memory dev mode
│   │                                                #   (no DATABASE_URL/REDIS_URL) vs persistent
│   │                                                #   mode (real Postgres + Redis + BullMQ),
│   │                                                #   mirroring services/api/src/main.ts's pattern
│   ├── jobs/
│   │   └── booking-notification-dispatcher.ts      # FIX: buildMessage always returns "email";
│   │                                                #   remove the sms branch entirely
│   ├── infrastructure/
│   │   ├── notifications/
│   │   │   ├── notification-relay.ts               # NEW: polls domain_events for unprocessed
│   │   │   │                                        #   booking-notification event types, enqueues
│   │   │   │                                        #   a BullMQ job per event (jobId = eventId),
│   │   │   │                                        #   inserts the notification_deliveries row
│   │   │   ├── notification-consumer.ts             # NEW: BullMQ Worker — calls
│   │   │   │                                        #   dispatchBookingNotification, updates the
│   │   │   │                                        #   delivery row to sent/failed
│   │   │   └── notification-delivery-store.ts       # NEW: port + in-memory + Drizzle adapters for
│   │   │                                             #   notification_deliveries
│   │   └── jobs/job-runner.ts                        # UNCHANGED (not reused directly — BullMQ's own
│   │                                                  #   retry/backoff supersedes it for this job
│   │                                                  #   type; see Architecture Decisions)
packages/persistence/src/
├── schema.ts                                        # + notificationDeliveries table
└── repositories/notification-delivery-repository.ts  # NEW: DrizzleNotificationDeliveryRepository
infra/postgres/013-notification-deliveries.sql         # NEW: table + RLS
docs/adr/0025-notification-outbox-relay.md              # NEW: records the outbox→BullMQ pattern,
                                                          #   closing ADR-0004's stated follow-up
```

**Structure Decision**: No new app/service. This is the first real bootstrap for the existing
`services/worker` package (previously a library of pure job functions with no entrypoint); one new
tenant-scoped table; one new workspace dependency (`bullmq`) that ADR-0004 already approved in
principle.

## Architecture Decisions

### 1. Fix the SMS/email branch (spec FR-002)

`buildMessage` in `booking-notification-dispatcher.ts` currently branches to `sms` whenever
`payload.customerPhone` is defined (lines 78-94 today). Delete the branch: always build the `email`
message. The existing test asserting "sends an SMS when customer has a phone number" is replaced with
one asserting email is sent regardless of phone presence.

### 2. Outbox relay instead of direct enqueue at the call site

ADR-0004 explicitly warns that BullMQ enqueue is not transactional with the PostgreSQL write that
creates the domain event, and mandates the outbox/audit-event pattern for critical transitions —
never resolved (`docs/adr/0004-queues-bullmq.md`, "Follow-up: document the outbox dispatch pattern").
`domain_events` (`infra/postgres/002-domain.sql`) is already exactly that outbox: every booking
transition writes there transactionally today (`DrizzleEventSink`), with no code change needed.

Rather than calling BullMQ's `add()` directly from `BookingService`/`AdminBookingService` at the
moment of transition (which risks losing the notification if the process crashes between the DB
commit and the enqueue call), a separate **relay** polls `domain_events` for event types that require
a customer notification, and for each one not yet represented in `notification_deliveries`:
1. Inserts a `notification_deliveries` row (`event_id` unique, status `queued`).
2. Enqueues a BullMQ job with `jobId: event.eventId` — BullMQ silently no-ops a duplicate `add()` with
   the same job id, so even if the relay re-scans the same event (e.g., two relay instances, or a
   crash mid-batch) the event is only ever queued once.

This closes ADR-0004's stated gap and gives at-least-once delivery with observable, deduplicated
outcomes (spec FR-004/FR-005/FR-006).

### 3. BullMQ consumer, not `job-runner.ts`'s in-memory idempotency store

`services/worker/src/infrastructure/jobs/job-runner.ts` (T080) provides a retry/idempotency wrapper,
but its `JobIdempotencyStore` port has only an in-memory implementation — it does not survive process
restarts and is not safe across multiple worker replicas, which is exactly the failure mode this
feature must not have (spec Edge Cases: "no pending notification may be lost... across a restart").
BullMQ already provides durable (Redis-backed), replica-safe retry/backoff and dedup-by-`jobId` — the
two properties `job-runner.ts` would need a new persistent store to match. Using BullMQ directly for
this job type avoids building a second, redundant persistence layer; `job-runner.ts` is left
unchanged for the job types that already use it.

### 4. Delivery outcome table, not a bare relay cursor

A simpler alternative to `notification_deliveries` would be a single "last relayed event" cursor. It
was rejected because the spec requires per-notification outcome visibility for staff (FR-005, FR-008:
"recorded and visible to staff", not just "not lost by the relay"). A cursor tells you where the relay
got to; it cannot answer "did event X's notification actually reach the customer, or is it still
retrying, or did it permanently fail and why." `notification_deliveries` (`event_id` unique,
`tenant_id`, `status: queued|sent|failed`, `attempts`, `last_error`, timestamps) answers that directly
and is the persisted form of the spec's "Notification Delivery Outcome" entity.

### 5. Worker bootstrap mirrors `services/api/src/main.ts`

`services/worker/src/main.ts` selects mode the same way `services/api` already does: with
`DATABASE_URL` **and** `REDIS_URL` present, wire the real Postgres-backed `notification-delivery-store`
+ real Redis/BullMQ; otherwise run an in-memory relay+consumer pair (same relay/consumer logic, an
in-memory queue standing in for BullMQ) so tests and local dev without infrastructure still exercise
the full flow. This mirrors the existing `persistentBootstrap()`/`inMemoryBootstrap()` split rather
than inventing a third pattern.

## Test Plan

| Level | Cases | Runs against |
|-------|-------|---------------|
| Unit | `buildMessage` always emits `email` regardless of `customerPhone`; relay selects only unprocessed events of notification-relevant types; consumer marks `sent` on success and `failed` after exhausting BullMQ's configured retry attempts | always |
| Integration | domain event written → relayed → `notification_deliveries` row `queued` → consumer processes → row `sent`; re-running the relay against the same event does not create a second delivery row or a second job; a provider failure is retried per the configured policy and eventually recorded `failed` with an error reason; Drizzle-backed store self-skips without Postgres | in-memory always; Drizzle/BullMQ integration self-skips without `DATABASE_URL`/`REDIS_URL` |
| E2E | Not added for real Brevo/Redis (out of scope, see spec Assumptions) — covered by the integration-level in-memory flow instead | n/a |

## Complexity Tracking

| Decision | Why | Alternative rejected |
|----------|-----|------------------------|
| New `bullmq` dependency + first `services/worker` bootstrap | ADR-0004 already decided on BullMQ for background jobs; this is the first feature that actually needs a running worker process, so it is the natural place to build the bootstrap once, correctly | Building an ad-hoc setTimeout-based poller instead of BullMQ would re-implement retry/backoff/dedup that BullMQ already provides, and would contradict the standing ADR without superseding it |
| New `notification_deliveries` table instead of adding a status column to `domain_events` | `domain_events` is documented as an append-only outbox shared by any future consumer (webhooks, calendar sync, etc.); adding a single consumer's status column would couple that shared table to one concern and block other consumers from having their own independent processing state over the same events | A shared status column forces every event consumer to agree on one state machine, or requires ad-hoc extra columns per consumer over time |

## Governance follow-up

This plan resolves ADR-0004's open follow-up ("document the outbox dispatch pattern"). Per the
constitution's Decision Policy (integration architecture changes require a written decision), a new
`docs/adr/0025-notification-outbox-relay.md` records the relay-then-queue pattern as a deliverable of
this feature's implementation phase, not as a pre-planning gate — it documents what gets built, it
does not re-open ADR-0004.
