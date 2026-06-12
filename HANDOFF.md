# Handoff

Last updated: 2026-06-12

## Read This First

This is the fastest resume document for Codex, Claude, or any future agent. Read this before making changes.

Implementation has started: the stack is decided (ADR-0001..0007), the Phase 1 workspace skeleton (T001-T006) and the Phase 2 tenant-safe foundations (T007-T014) are in place. The next work is Phase 3, User Story 1 (T015-T026): tenant publishes a complete bookable operation.

## Current Objective

Prepare and implement a SaaS-native multitenant booking platform inspired by Amelia Premium, using the existing Spec Kit artifacts as the product and architecture source of truth.

## Current Repo State

- Working branch: `claude/optimistic-babbage-8vdefc` (branched from `main` at `7d6842e`, plus the cross-agent docs commit `a36a6e1`).
- Remote: `origin https://github.com/jav13rrez/saas-reservas.git`
- Stack decisions recorded as ADR-0001 through ADR-0007 in `docs/adr/`: Next.js, Fastify, Drizzle, BullMQ, first-party cookie sessions, deferred AIProviderAdapter, Docker Compose for local dev.
- T001-T006 complete: pnpm workspace (`pnpm-workspace.yaml`), root tooling (`package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`), and `packages/contracts` with `environment.ts` and `openapi.ts`.
- T007-T014 complete: `infra/postgres/001-tenancy.sql` (RLS template + `apply_tenant_rls`), `infra/docker-compose.yml` (Postgres/Redis/MinIO), `packages/tenant-context` (Postgres tenant context, Redis keys, storage paths), `services/api` tenant resolver, `packages/domain` audit/event primitives, `services/worker` `runTenantJob` wrapper, and 9 passing RLS/worker integration tests.
- Verification commands available and passing: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`.
- Integration tests need PostgreSQL: `docker compose -f infra/docker-compose.yml up -d postgres`, then `TEST_DATABASE_URL=postgres://saas_admin:saas_admin@localhost:5432/saas_reservas pnpm test:integration` (default URL matches the compose service, so the env var is optional). Suites self-skip when no database is reachable.
- Local reference folders exist but are ignored by Git: `reference/`, `archive/`, `.codex/`.

## What Matters Most

Use these documents:

- `PLANNING.md`: map, route, and operating model.
- `PROGRESS.md`: what already happened.
- `.specify/memory/constitution.md`: non-negotiable principles.
- `specs/001-saas-multitenant-booking/plan.md`: technical architecture.
- `specs/001-saas-multitenant-booking/tasks.md`: implementation backlog.

Do not treat `reference/` or `archive/` as source code. They are local research inputs only.

## Next Actions

Recommended next steps:

1. Merge the working branch `claude/optimistic-babbage-8vdefc` into `main` when the user approves.

2. Start Phase 3 / User Story 1 (`T015`-`T026`), tests first (`T015`-`T018`): provider schedules with timezones, service duration/buffer/extras rules, shared resource conflicts, and the single-provider widget scenario; then domain entities, application services, availability engine v1, APIs, and minimal admin UI.

3. T026 introduces the first Next.js app under `apps/admin` (ADR-0001); scaffold it as a workspace package when that task starts.

4. After each meaningful implementation session, update `PROGRESS.md`, `HANDOFF.md`, and `tasks.md`.

## Current Task Pointer

Phases 1 and 2 (T001-T014) are complete.

Next task:

```text
T015 Add tests for provider schedule, breaks, days off, special days, and timezone handling in tests/unit/scheduling/provider-schedule.test.ts
```

## Important Constraints

- Tenant isolation is non-negotiable.
- PostgreSQL RLS and `tenant_id` discipline are foundational.
- Redis keys, storage paths, worker payloads, webhooks, logs, metrics, and audit records must carry tenant identity.
- No confirmed booking without availability, resource, calendar, payment, and policy validation.
- WordPress and Amelia are references only; do not reproduce WordPress coupling.
- External integrations must be adapter-based.
- Secrets must never be committed.

## Reference Material

Local-only reference material:

- `reference/amelia-source/`: Amelia Premium plugin source.
- `reference/graphify/saas-core/`: most useful focused Graphify output.
- `reference/graphify/backend/`: backend-focused Graphify output.
- `archive/graphify-full/`: noisy full graph snapshot.

These paths are ignored by Git except for their README files.

## If Context Is Lost

Rebuild context in this order:

1. `README.md`
2. `HANDOFF.md`
3. `PLANNING.md`
4. `PROGRESS.md`
5. `.specify/memory/constitution.md`
6. `specs/001-saas-multitenant-booking/plan.md`
7. `specs/001-saas-multitenant-booking/tasks.md`

## Do Not Do Without Explicit User Approval

- Do not delete `reference/` or `archive/`.
- Do not push to GitHub unless the user confirms.
- Do not install ECC wholesale.
- Do not commit Amelia Premium source or Graphify generated heavy outputs.
- Do not change the constitution lightly.
- Do not choose a major framework silently if trade-offs are still open.
