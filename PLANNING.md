# Planning

Last updated: 2026-06-12

## Purpose

This file is the durable project map for any agent or human joining the work. It explains the route, the source-of-truth documents, and the operating rules that should survive across Codex, Claude, and future tools.

## Product Direction

Build a native multitenant booking SaaS inspired by Amelia Premium behavior, but not by its WordPress runtime. Amelia and Graphify are reference material only. The new system must be SaaS-native, tenant-safe, auditable, and extensible across multiple business verticals.

## Source Of Truth

Read these in order when a session starts:

1. `HANDOFF.md`: current resume point and next actions.
2. `PLANNING.md`: this project map and operating model.
3. `PROGRESS.md`: timeline of what has been done and what changed recently.
4. `.specify/memory/constitution.md`: non-negotiable principles.
5. `specs/001-saas-multitenant-booking/plan.md`: technical plan and target structure.
6. `specs/001-saas-multitenant-booking/tasks.md`: implementation backlog.
7. `GRAPH_VARIANTS.md`: how to use local Amelia/Graphify reference material when needed.

## Current Feature

Feature directory:

```text
specs/001-saas-multitenant-booking/
```

Key artifacts:

- `spec.md`: functional requirements and user stories.
- `plan.md`: implementation plan and architecture.
- `tasks.md`: ordered backlog, currently `T001` through `T086`.
- `data-model.md`: domain entities.
- `contracts/openapi.yaml`: API contract seed.
- `quickstart.md`: validation scenarios.
- `research.md`: key decisions and trade-offs from the Amelia analysis.

## Architecture Baseline

- Modular monolith first.
- TypeScript 5.x as shared language across apps, API, workers, and packages.
- PostgreSQL with shared-database multitenancy and Row-Level Security.
- Redis for locks, queues, cache, waitlist tokens, and short-lived coordination.
- Object storage compatible with S3/GCS using `tenants/{tenant_id}/...` paths.
- Async workers for notifications, calendar sync, webhook processing, file scanning, recurring jobs, waitlist promotion, and payment reconciliation.
- Adapter boundaries for payments, calendars, meetings, WhatsApp, email/SMS, storage, file scanning, and future AI/model providers.

## Operating Model

This project should remain agent-agnostic:

- Codex reads `AGENTS.md`.
- Claude reads `CLAUDE.md`.
- Both must follow `PLANNING.md`, `PROGRESS.md`, and `HANDOFF.md`.
- Spec Kit remains the main product/implementation planning system.
- Graphify/Amelia references are local research inputs, not source code.

## Session Start Routine

Every new session should:

1. Read `HANDOFF.md`.
2. Check `git status -sb`.
3. Read the current task section in `tasks.md`.
4. Confirm whether work is planning, implementation, review, or cleanup.
5. Avoid touching `reference/` and `archive/` unless explicitly investigating Amelia context.

## Session End Routine

Before ending a meaningful session:

1. Update `PROGRESS.md` with a dated entry.
2. Update `HANDOFF.md` with the current state, next actions, blockers, and changed files.
3. If tasks were completed, mark them in `tasks.md`.
4. If an architecture decision was made, add or update an ADR under `docs/adr/`.
5. Run the available verification commands for the stage of the project.

## Quality Gates

No implementation should be considered ready without:

- Tests for tenant isolation, booking correctness, payments, integrations, and privacy where relevant.
- Typecheck, lint, and test commands passing once the workspace exists.
- Security review for auth, tenant boundaries, file uploads, payments, OAuth, webhooks, and secrets.
- Updated docs when behavior, architecture, or task status changes.

## Decision Policy

Create an ADR for decisions that affect:

- framework selection,
- tenancy strategy,
- database/ORM/migration strategy,
- auth/session model,
- payment flow,
- integration architecture,
- AI/model-provider strategy,
- privacy/security posture,
- deployment/runtime topology.

ADRs live in `docs/adr/`.

## Immediate Route

Stack decisions are closed (ADR-0001..0008) and Phases 1-6 (`T001`-`T061`) are merged into `main`. The route ahead:

1. Phase 7 / User Story 5 (`T062`-`T075`): premium integrations — credential vault, calendar OAuth, WhatsApp, messaging/meeting adapters, attachments, outbound webhooks.
2. Phase 8 (`T076`-`T086`): observability, billing, workers, seeds, and product readiness.
3. Cross-cutting follow-ups tracked in `HANDOFF.md`: staff auth for admin routes, real payment gateway adapters, events persistence in Drizzle, production server bootstrap, and restyling existing screens to `docs/design-system.md`.
