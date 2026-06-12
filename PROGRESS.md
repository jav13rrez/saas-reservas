# Progress

Last updated: 2026-06-11

## Current State

Implementation has started. Stack decisions are recorded as ADRs, Phase 1 setup (T001-T006) and Phase 2 tenant-safe foundations (T007-T014) are complete: tenancy SQL with RLS template, tenant-context package (Postgres context, Redis keys, storage paths), request tenant resolver, audit/event primitives, worker job wrapper, and passing RLS/worker integration tests.

Current branch:

```text
claude/optimistic-babbage-8vdefc
```

Current clean baseline commit:

```text
7d6842e Initial clean project baseline
```

## Completed

### 2026-06-09

- Installed and used Graphify to analyze the Amelia Premium plugin.
- Created focused Graphify variants for complete architecture, backend, and SaaS core.
- Identified `graphify-saas-core-out` as the most useful architecture graph.
- Installed Spec Kit and initialized project planning artifacts.
- Created feature `001-saas-multitenant-booking`.
- Rewrote `constitution.md`, `spec.md`, `plan.md`, and `tasks.md` using the detailed Amelia analysis.
- Generated supporting artifacts: `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`, and requirements checklist.
- Validated Spec Kit prerequisites and task numbering.

### 2026-06-11

- Moved Amelia and Graphify material out of the active project root.
- Kept local reference material under `reference/` and noisy generated output under `archive/`.
- Updated `AGENTS.md`, `GRAPH_VARIANTS.md`, `.graphifyignore`, and `.graphifyignore.backend`.
- Prepared the GitHub repo baseline.
- Added `.gitignore` and `README.md`.
- Removed local Amelia/Graphify reference material from Git tracking while preserving it on disk.
- Created a clean `main` commit suitable for GitHub.
- Kept previous heavy commit locally as `backup/pre-clean-upload`.
- Analyzed ECC as an operating-model reference and decided to adopt its ideas selectively, not install it wholesale.
- Added cross-agent continuity files: `PLANNING.md`, `PROGRESS.md`, `HANDOFF.md`, `CLAUDE.md`, and ADR scaffolding.

### 2026-06-11 (implementation start)

- Closed the seven open stack decisions with the project owner and recorded them as ADR-0001 through ADR-0007 in `docs/adr/`: Next.js (frontend), Fastify (API), Drizzle + SQL migrations (data access), BullMQ on Redis (queues), first-party cookie sessions with split staff/customer auth, deferred AIProviderAdapter interface, Docker Compose for local dev with cloud target deferred.
- Completed T001-T006: workspace placeholders, pnpm/TypeScript monorepo tooling (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`), ESLint flat config + Prettier, Vitest projects for unit/integration/contract/e2e, environment configuration contract (`packages/contracts/src/environment.ts`, zod-validated), and OpenAPI builder foundation (`packages/contracts/src/openapi.ts`).
- Added `.prettierignore` so Spec Kit artifacts and reference material keep their own formatting.
- Verified `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test` all pass (tests pass with no test files yet; first real tests arrive in T013).

### 2026-06-12

- Completed T007-T014 (Phase 2, tenant-safe foundations):
  - `infra/postgres/001-tenancy.sql`: tenancy conventions, `tenants` registry, fail-closed `current_tenant_id()` function, and `apply_tenant_rls(regclass)` policy template (restrictive + permissive policies, FORCE RLS).
  - `infra/docker-compose.yml`: Postgres 16 + Redis 7 + MinIO per ADR-0007, with `infra/postgres/` mounted as init scripts.
  - `packages/tenant-context`: driver-agnostic `withTenantContext`/`setTenantContext`/`getTenantContext` (transaction-local `set_config`), Redis key helpers (`tenant:{id}:...`, `lock:{id}:{provider}:{resource}:{startISO}`, 10-min default TTL), and storage path helpers (`tenants/{id}/...`, signed URL TTL policy).
  - `services/api/src/infrastructure/tenancy/tenant-resolver.ts`: subdomain/custom-domain/authenticated resolution with session-vs-host tenant mismatch rejection and inactive-tenant handling.
  - `packages/domain/src/audit/events.ts`: domain event + audit record primitives (constitution principle V), outbox note linked to ADR-0004.
  - `services/worker/src/jobs/run-tenant-job.ts`: job wrapper that validates `tenantId` and binds tenant context before any handler query.
  - Integration tests `tenant-rls.test.ts` and `worker-tenant-context.test.ts`: 9 tests proving RLS fail-closed behavior, cross-tenant read/write/update/delete blocking, context binding before handler execution, and job transaction rollback. Verified green against a local PostgreSQL 16 instance; suites self-skip with a notice when no database is reachable.

## Current Backlog

Primary implementation backlog:

```text
specs/001-saas-multitenant-booking/tasks.md
```

Current task count:

```text
T001-T086
```

Current next task:

```text
T015 Add tests for provider schedule, breaks, days off, special days, and timezone handling (Phase 3 / User Story 1)
```

## Open Decisions

- Production deployment target, reverse proxy/tenant routing topology, and managed-service choices (deferred by ADR-0007).
- All previously open stack decisions are now closed in ADR-0001 through ADR-0007.

## How To Update This File

Append dated entries when:

- a task is completed,
- the plan/spec changes,
- a major decision is made,
- a repo hygiene action happens,
- a handoff-relevant risk appears.

Keep entries factual and brief. Put "what to do next" in `HANDOFF.md`, not here.
