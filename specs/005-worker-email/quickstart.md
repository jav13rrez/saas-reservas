# Quickstart & Acceptance: Email Notification Worker

**Feature**: 005-worker-email | **Date**: 2026-07-01

Validation scenarios mapped to the spec's user stories and success criteria. Each is exercised by an
automated test (unit/integration per the plan's Test Plan) and, where noted, reproducible by hand
against a running stack.

## Preconditions

- In-memory mode (tests, local dev without infra): no `DATABASE_URL`/`REDIS_URL` needed — the worker's
  in-memory relay+queue stands in for Postgres/BullMQ.
- Persistent mode (manual/staging validation): `DATABASE_URL`, `REDIS_URL`, and either `BREVO_API_KEY`
  + `MESSAGING_FROM_EMAIL` (real send) or none set (fake `MessageProvider`, still exercises the whole
  pipeline without an external call).

---

## S1 — Every supported event reaches email, never SMS (US1, SC-001/SC-002)

1. Trigger each of the 7 booking events (confirmed/cancelled/rescheduled/reminder/rejected/completed/
   no_show) for a customer with **both** an email and a phone number on file.
2. **Expect**: for every event, the consumer builds and sends an `email` message; no `sms` message is
   ever built or sent, regardless of the phone number being present.

## S2 — Notification fires without any manual trigger (US2, SC-003)

1. In persistent mode, perform a booking status transition through the normal application flow (e.g.
   `POST /v1/admin/bookings/:id/approve`) — not a direct call to `dispatchBookingNotification`.
2. **Expect**: within one relay polling interval, a `notification_deliveries` row appears for that
   event (`status: queued`, then `sent`), with no operator action.
3. The booking API call itself returns before the email is confirmed sent (FR-009) — assert the HTTP
   response time is not coupled to the message provider's latency.

## S3 — Transient provider failure is retried, not lost (US2, SC-004)

1. Configure a fake `MessageProvider` that fails the first N attempts then succeeds.
2. Trigger a booking event.
3. **Expect**: the `notification_deliveries` row's `attempts` increments across retries, `status`
   stays `queued` until the provider succeeds, then becomes `sent`. No duplicate email is sent once it
   succeeds.

## S4 — Permanent failure is recorded, not silent (Edge Cases, FR-005/FR-008)

1. Configure the fake `MessageProvider` to fail every attempt.
2. Trigger a booking event.
3. **Expect**: after BullMQ exhausts its configured attempts, the `notification_deliveries` row
   becomes `status: failed` with `lastError` populated and `resolvedAt` set — queryable by staff/audit,
   not silently dropped.

## S5 — No duplicate delivery under relay re-runs or restarts (SC-005, Edge Cases)

1. Trigger a booking event; let the relay enqueue it once.
2. Manually invoke the relay's polling pass again (simulating an overlapping run or a restart before
   the poll interval would naturally elapse).
3. **Expect**: still exactly one `notification_deliveries` row for that `eventId`, and the BullMQ queue
   still has exactly one job for that `jobId` — the second relay pass is a no-op for this event.

## S6 — No contact channel available (Edge Cases)

1. Trigger a booking event for a customer record with no usable email (e.g., empty string — malformed
   email is out of scope for realistic seed data, but the pipeline must not crash).
2. **Expect**: the delivery is recorded `failed` with a `lastError` describing the missing channel,
   rather than throwing an unhandled exception in the consumer.

---

## Manual smoke (persistent mode, optional)

1. Boot `services/worker` with `DATABASE_URL`, `REDIS_URL`, and the fake `MessageProvider` (no
   `BREVO_API_KEY`).
2. Approve a pending booking via the admin API.
3. Query `notification_deliveries` for that booking's `eventId` → expect `status: sent` within a few
   seconds.
4. (Separately, on the operator's machine, with real Brevo credentials and network egress allowed —
   not run in this environment) repeat against the real `BrevoMessageProvider` to confirm an actual
   email arrives. This step validates the already-existing Brevo adapter, not new code from this
   feature.
