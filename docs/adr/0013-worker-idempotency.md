# ADR-0013: Worker Idempotency and Retry Policy

**Status:** Accepted  
**Date:** 2026-06-15  
**Tasks:** T080

## Context

BullMQ guarantees at-least-once delivery; a job may be executed more than once due to worker restarts, Redis failover, or manual re-queues. Without idempotency controls, duplicate executions can cause double-sends, double-charges, or duplicate audit entries.

## Decision

All async jobs use `runJob()` from `@saas-reservas/worker/infrastructure/jobs/job-runner`, which provides:

**Idempotency:**

- Each job payload carries `(tenantId, jobType, idempotencyKey)`.
- Before execution, `JobIdempotencyStore.hasProcessed()` is checked; if true, the job returns `{ skipped: true }` immediately without running the handler.
- After success or final failure, `markProcessed()` records the outcome. A job that was marked `failed` is NOT re-skipped — it must be re-queued with a new `idempotencyKey` to retry after a manual review.

**Retry policy (DEFAULT_JOB_RETRY):**

- `maxAttempts: 3`
- `baseDelayMs: 2000`
- `backoffFactor: 3` → delays: 2s, 6s after attempts 1 and 2

**Idempotency key naming conventions:**

- Notification: `notify:{bookingId}:{event}`
- Reconciliation: `reconcile:{tenantId}:{periodStart}`
- Calendar sync: `calsync:{tenantId}:{provider}:{sinceDate}`
- Webhook dispatch: `webhook:{subscriptionId}:{eventId}`

In production, `JobIdempotencyStore` is backed by a Redis hash with a 30-day TTL; `InMemoryJobIdempotencyStore` is used in tests and dev.

## Consequences

- Duplicate job executions are safe by construction.
- A job failing all 3 attempts is recorded as `failed` and emits an alert; it will not be automatically re-retried.
- The idempotency store is in the hot path; Redis latency (~0.5 ms) is acceptable vs the risk of duplicate side-effects.
- Jobs must not perform side-effects before the idempotency check (e.g., no sending emails in constructor code).
