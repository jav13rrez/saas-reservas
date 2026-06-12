# ADR-0004: BullMQ On Redis For Background Jobs

**Date**: 2026-06-11
**Status**: accepted
**Deciders**: Project owner + agent

## Context

The constitution already fixes Redis for locks, queues, cache, and short-lived coordination. Workers must handle notifications, calendar sync, webhook processing, file scanning, recurring jobs, waitlist promotion, and payment reconciliation — with retries, delayed/scheduled jobs, and repeatable jobs.

## Decision

Use BullMQ in `services/worker`. Every job payload carries `tenant_id`; the worker bootstrap sets tenant context before any tenant-owned database access (verified by T014). Queue names are platform-level, tenant identity lives in payloads and lock keys per the constitution's Redis namespacing rules.

## Alternatives Considered

- Graphile Worker: transactional enqueue with Postgres data is attractive for correctness, but it introduces a second job system while the constitution mandates Redis for queues.
- Custom Redis queues: full control but reimplements retries, scheduling, rate limiting, and observability that BullMQ already provides.
- Cloud-managed queues (SQS, etc.): premature vendor lock-in before the deployment target is decided.

## Consequences

- Mature retry/backoff, delayed jobs, repeatable jobs, and flow support out of the box.
- Negative: enqueue is not transactional with PostgreSQL writes; critical transitions must use the outbox/audit-event pattern (domain events table) to guarantee delivery.
- Follow-up: document the outbox dispatch pattern when implementing T012 (event/audit primitives).
