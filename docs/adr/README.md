# Architecture Decision Records

This directory stores durable architecture decisions for the SaaS Reservas project.

Use ADRs for decisions that affect framework choice, tenancy, database strategy, auth, payments, integrations, AI/model-provider strategy, privacy, deployment, or long-term operational behavior.

## Index

| ADR                                          | Title                                                       | Status   | Date       |
| -------------------------------------------- | ----------------------------------------------------------- | -------- | ---------- |
| [0001](0001-frontend-nextjs.md)              | Next.js App Router As Frontend Shell                        | accepted | 2026-06-11 |
| [0002](0002-backend-fastify.md)              | Fastify As Backend API Framework                            | accepted | 2026-06-11 |
| [0003](0003-data-access-drizzle.md)          | Drizzle ORM With SQL Migrations                             | accepted | 2026-06-11 |
| [0004](0004-queues-bullmq.md)                | BullMQ On Redis For Background Jobs                         | accepted | 2026-06-11 |
| [0005](0005-auth-session-model.md)           | First-Party Cookie Sessions With Split Staff/Customer Auth  | accepted | 2026-06-11 |
| [0006](0006-ai-provider-adapter-deferred.md) | Reserve AIProviderAdapter Interface, Defer Implementation   | accepted | 2026-06-11 |
| [0007](0007-local-dev-docker-compose.md)     | Docker Compose For Local Development, Cloud Target Deferred | accepted | 2026-06-11 |
| [0008](0008-design-system.md)                | Design System — Holded-Inspired UI With Lucide Icons        | accepted | 2026-06-12 |
| [0015](0015-resource-model-locations-eligibility.md) | Resource Model — Locations And Provider Eligibility | accepted | 2026-06-16 |
| [0016](0016-resource-hub-model.md)           | Resource Hub Model — Partial Amelia Alignment               | accepted | 2026-06-16 |
| [0017](0017-staff-auth-implementation.md)    | Staff Authentication Implementation                         | accepted | 2026-06-17 |

## Template

```markdown
# ADR-NNNN: Decision Title

**Date**: YYYY-MM-DD
**Status**: proposed | accepted | superseded
**Deciders**: Name(s) or "Project owner + agent"

## Context

What problem or constraint forced this decision?

## Decision

What did we decide?

## Alternatives Considered

- Alternative A: pros, cons, why rejected.
- Alternative B: pros, cons, why rejected.

## Consequences

- Positive consequences.
- Negative trade-offs.
- Follow-up work.
```
