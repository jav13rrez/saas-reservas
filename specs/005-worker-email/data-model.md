# Phase 1 Data Model: Email Notification Worker

**Date**: 2026-07-01 | **Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This feature adds one new persisted entity. It reads, but does not modify, the existing
`domain_events` outbox and the existing `BookingNotificationPayload`/`BookingNotificationEvent`
types in `services/worker/src/jobs/booking-notification-dispatcher.ts`.

## Entity: NotificationDelivery (new)

Source: `packages/persistence/src/schema.ts` (new `notificationDeliveries` table) · Table:
`notification_deliveries` (migration `infra/postgres/013-notification-deliveries.sql`, RLS).

Persisted form of the spec's "Notification Delivery Outcome" key entity — one row per relayed
`domain_events` row that requires a customer notification.

| Field | Type | Rules / Validation | Notes |
|-------|------|---------------------|-------|
| `id` | uuid | PK | delivery record identity |
| `tenantId` | uuid | not null, RLS-scoped | tenant isolation (constitution I) |
| `eventId` | uuid | not null, **unique** | FK-like reference to `domain_events.event_id`; the uniqueness is what makes relaying idempotent (spec FR-006) |
| `bookingId` | uuid | not null | denormalized from the event payload, for staff lookup without a join |
| `notificationEvent` | text | one of the 7 `BookingNotificationEvent` values | which lifecycle event this delivery corresponds to |
| `status` | text | `queued` \| `sent` \| `failed` | see State Transitions below |
| `attempts` | integer | ≥ 0, default 0 | incremented by the consumer on each BullMQ attempt |
| `lastError` | text? | optional | set on `failed`; cleared (`null`) on `sent` |
| `queuedAt` | timestamptz | not null | when the relay first enqueued the job |
| `resolvedAt` | timestamptz? | optional | when the row reached `sent` or `failed` |

### State Transitions

```
queued --(consumer succeeds)--> sent
queued --(consumer exhausts BullMQ retry attempts)--> failed
```

- `queued` is set by the **relay** in the same operation that enqueues the BullMQ job (spec FR-004
  precondition: nothing is queued twice, enforced by the `eventId` unique constraint).
- `sent`/`failed` are terminal — a delivery row is never re-queued automatically. (A future manual
  "resend" action, if ever requested, would be a new feature, not implied by this one — see spec Out
  of scope.)
- There is no `retrying` status: BullMQ's own attempt/backoff mechanism handles retries internally
  between `queued` and the terminal state; `attempts` is a read-only counter for staff visibility, not
  a driver of behavior in this table.

## Existing types this feature reads but does not change

- `BookingNotificationEvent` (`services/worker/src/jobs/booking-notification-dispatcher.ts`): the 7
  values (`confirmed`, `cancelled`, `rescheduled`, `reminder`, `rejected`, `completed`, `no_show`) —
  the relay's filter for "which `domain_events.type` values require a notification."
- `BookingNotificationPayload`: unchanged shape; the consumer builds it from the `domain_events.payload`
  JSONB column (already written transactionally with the booking transition) plus a booking/customer
  lookup where the event payload doesn't already carry a needed field (e.g. `meetingJoinUrl`).
- `domain_events` (`packages/persistence/src/schema.ts`, existing): read-only for this feature. No
  schema change.
