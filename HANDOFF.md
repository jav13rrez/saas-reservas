# Handoff

Last updated: 2026-06-12

## Read This First

This is the fastest resume document for Codex, Claude, or any future agent. Read this before making changes.

Implementation has started: the stack is decided (ADR-0001..0007) and Phases 1-4 (T001-T040) are complete, including User Story 2 end to end (slot validation -> locks -> pending booking -> cart charge -> idempotent webhook confirmation -> occupancy). The next work is Phase 5, User Story 3 (T041-T052): staff and customers manage changes under tenant policies and privacy rules.

The Drizzle/RLS persistence adapter is DONE: `packages/persistence` implements every repository port against PostgreSQL with per-transaction tenant context, verified end to end by `tests/integration/persistence/drizzle-checkout.test.ts`. In-memory adapters remain for fast tests/dev.

Remaining v1 simplifications: `/v1/admin/*` routes have no staff auth yet (identity tasks pending) so they are development-only; customers are generated ids until the customer registry lands; the payment gateway is the fake adapter behind the real `PaymentGateway` port; there is no production server bootstrap yet wiring the Drizzle adapters (compose them like the persistence test does).

## Current Objective

Prepare and implement a SaaS-native multitenant booking platform inspired by Amelia Premium, using the existing Spec Kit artifacts as the product and architecture source of truth.

## Current Repo State

- Working branch: `claude/optimistic-babbage-8vdefc` (branched from `main` at `7d6842e`, plus the cross-agent docs commit `a36a6e1`).
- Remote: `origin https://github.com/jav13rrez/saas-reservas.git`
- Stack decisions recorded as ADR-0001 through ADR-0007 in `docs/adr/`: Next.js, Fastify, Drizzle, BullMQ, first-party cookie sessions, deferred AIProviderAdapter, Docker Compose for local dev.
- T001-T006 complete: pnpm workspace (`pnpm-workspace.yaml`), root tooling (`package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`), and `packages/contracts` with `environment.ts` and `openapi.ts`.
- T007-T014 complete: `infra/postgres/001-tenancy.sql` (RLS template + `apply_tenant_rls`), `infra/docker-compose.yml` (Postgres/Redis/MinIO), `packages/tenant-context` (Postgres tenant context, Redis keys, storage paths), `services/api` tenant resolver, `packages/domain` audit/event primitives, `services/worker` `runTenantJob` wrapper, and 9 passing RLS/worker integration tests.
- T015-T026 complete (User Story 1): scheduling/catalog/tenancy domain modules in `packages/domain`, availability engine + availability/tenant-admin/catalog application services in `services/api/src/application`, Fastify API in `services/api/src/api/availability-routes.ts`, in-memory repository adapter in `services/api/src/infrastructure/memory`, and the Next.js admin app in `apps/admin` (builds with `next build`).
- T027-T040 complete (User Story 2): booking + payment domain (`packages/domain/src/bookings`, `payments`), pricing/lock/booking/cart-reconciliation services (`services/api/src/application`), `PaymentGateway` adapter boundary + fake gateway (`packages/integrations`), Redis lock store + webhook idempotency (`services/api/src/infrastructure`), checkout + webhook routes (`services/api/src/api/checkout-routes.ts`), and the `apps/booking-widget` Next.js checkout UI. 58 tests passing across unit/integration/e2e.
- Redis integration tests need a Redis: `docker compose -f infra/docker-compose.yml up -d redis` (default `redis://127.0.0.1:6379`, override with `TEST_REDIS_URL`). They self-skip when unreachable.
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

2. Start Phase 5 / User Story 3 (`T041`-`T052`), tests first (`T041`-`T044`): cancel/reschedule policy windows, GDPR anonymization, and customer/staff panel flows.

3. Consider a small server bootstrap (`services/api/src/main.ts`) that loads `environment.ts`, builds the Drizzle adapters like `tests/integration/persistence/drizzle-checkout.test.ts` does, and starts Fastify — that makes the stack runnable outside tests.

4. After each meaningful implementation session, update `PROGRESS.md`, `HANDOFF.md`, and `tasks.md`.

## Current Task Pointer

Phases 1-4 (T001-T040) are complete.

Next task:

```text
T041 Add tests for minimum cancel/reschedule windows and rejected attempts in tests/unit/bookings/change-policy.test.ts
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
