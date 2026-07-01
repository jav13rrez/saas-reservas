# Internal Contract: Notification Relay → BullMQ Queue → Consumer

**Feature**: 005-worker-email | **Date**: 2026-07-01

This feature exposes no public HTTP API. Its "contract" is the internal boundary between the relay
producer and the BullMQ consumer — documented here so the two can be implemented and tested
independently against a stable interface.

## Queue

- **Name**: `booking-notifications` (platform-level, per ADR-0004 — tenant identity lives in the job
  payload, not the queue name).
- **Job id**: `event.eventId` (the `domain_events.event_id` of the triggering booking event). BullMQ
  treats `add()` calls with a duplicate `jobId` as a no-op, which is the mechanism that makes relay
  re-runs safe (spec FR-006).

## Job payload (producer → consumer)

```ts
interface NotificationJobPayload {
  tenantId: string; // domain_events.tenant_id
  eventId: string; // domain_events.event_id — also the BullMQ jobId
  bookingId: string;
  notificationEvent: BookingNotificationEvent; // "confirmed" | "cancelled" | ... | "no_show"
  // Everything dispatchBookingNotification needs to build the message, taken from
  // domain_events.payload at enqueue time (the event payload already carries this today):
  customerEmail: string;
  customerName: string;
  serviceName: string;
  providerName: string;
  startAt: string; // ISO datetime
  durationMinutes: number;
  meetingJoinUrl?: string;
}
```

Note: `customerPhone` is intentionally **not** part of this payload — the consumer only ever builds an
email message (spec FR-002), so there is nothing for a phone number to influence.

## Producer responsibilities (relay)

1. Query `domain_events` for rows whose `type` is one of the 7 notification-relevant event types and
   that have no corresponding row in `notification_deliveries` (by `event_id`).
2. For each: insert a `notification_deliveries` row (`status: "queued"`), then `queue.add("notify",
   payload, { jobId: event.eventId })`.
3. Order of operations (insert delivery row, then enqueue) matters: if the process crashes between the
   two, the next relay run finds the `domain_events` row still has no matching delivery... **unless**
   the insert already happened. To keep this safe without a two-phase commit, the relay treats a
   unique-constraint violation on the `notification_deliveries` insert as "already being handled,
   skip" rather than an error — making the whole step idempotent regardless of where a crash occurs.

## Consumer responsibilities (BullMQ worker)

1. Receive `NotificationJobPayload`, build a `BookingNotificationPayload` (from the job payload
   directly — no extra DB lookup required in the common case), call the existing (email-only, post-fix)
   `dispatchBookingNotification`.
2. On success: update the matching `notification_deliveries` row to `status: "sent"`, `resolvedAt: now`,
   `lastError: null`, `attempts: attempts + 1`.
3. On failure within BullMQ's configured attempt budget: let BullMQ retry (increment `attempts` on the
   delivery row on each attempt, leave `status: "queued"`).
4. On failure after BullMQ exhausts its configured attempts: update the row to `status: "failed"`,
   `resolvedAt: now`, `lastError: <last error message>`.

## Retry/backoff policy

BullMQ job options: `attempts: 5`, `backoff: { type: "exponential", delay: 2000 }` (2s, 4s, 8s, 16s,
32s — bounded, per spec FR-004 "a bounded number of retries"). Chosen as a standard, conservative
default for transactional email; not a product decision requiring sign-off (see spec Assumptions).
