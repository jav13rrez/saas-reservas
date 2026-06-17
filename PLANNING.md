# Planning

Last updated: 2026-06-16

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

## Current Implementation State

All spec tasks T001–T086 (Phases 1–8, User Stories 1–5) are complete and merged into `main`. ADRs 0001–0016 record all stack and architecture decisions.

The admin console (`apps/admin`) implements the full assignment chain end to end using process-local Next.js route handlers (`src/server/demo-store.ts`):

```
Ubicación → Recurso → Proveedor → Servicio → Reserva → Cliente → Calendario
```

The **Resource hub model** (ADR-0016) was adopted: the Resource entity declares `locationIds[]`, `serviceIds[]` and `employeeIds[]` (empty = "any"). This replaced the old 1→1 `service.resourceId` and provider-side `resourceIds`. The admin UI reflects this: Recursos is the single configuration hub; Proveedores and Servicios no longer carry resource references.

A full sweep of the Amelia Premium admin console is permanently recorded in `docs/analysis/amelia-ux-reference.md` as a UX/product reference for all future feature work.

## Immediate Route (post-spec)

Prioritized follow-up work — see `HANDOFF.md` for detail:

1. **Canonical domain/persistence hub migration** — *COMPLETE (2026-06-17)*. Additive hub layer + read-model cutover (`AvailabilityService`/checkout/reschedule/Fastify read the hub pool via `hub-resources.ts`) + **provider locations** (`provider_locations`, `005-*.sql`, real hub location compatibility) + **destructive drop** of the legacy model-B tables `provider_resources` and `service_resources` (`006-*.sql`) and all their plumbing. The availability engine is untouched. `resources.location_id` was also dropped (`007-*.sql`); the hub is now the complete and sole resource model with no legacy remnants.
2. **Production server bootstrap**: `services/api/src/main.ts` wiring Drizzle adapters (pattern in `tests/integration/persistence/drizzle-checkout.test.ts`).
3. **Staff auth**: `/v1/admin/*` routes use a dev-only `x-provider-id` header; real JWT/API-key auth is deferred.
4. **Real adapter wiring**: swap fake gateway, message provider, KMS, and storage adapters for Stripe Connect, SendGrid/Twilio, AWS KMS, and S3.
5. **Scheduling per provider**: Work hours / Days off / Special days — noted in Amelia UX reference as a key gap in our current admin.
6. **Deferred resource features**: quantity partition (`shared/per-service/per-location`) and group booking (registered in ADR-0016 and `amelia-ux-reference.md` pending decisions #1/#4).
