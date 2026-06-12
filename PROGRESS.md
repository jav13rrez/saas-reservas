# Progress

Last updated: 2026-06-11

## Current State

Implementation has started. Stack decisions are recorded as ADRs; Phases 1-4 (T001-T040) are complete: tenant-safe foundations, User Story 1 (publishable bookable operation), and User Story 2 (transactional checkout with locks, pricing, payments, and webhook-driven confirmation). 58 tests passing across unit/integration/e2e, including suites against real PostgreSQL (RLS) and real Redis (locks).

Known v1 simplifications: repositories are in-memory adapters behind ports (Drizzle/RLS persistence adapter pending in `packages/persistence`); `/v1/admin/*` routes have no staff auth yet (identity tasks pending) so they are development-only; checkout holds live in process memory (must move to persistence with the Drizzle adapter); customers are generated ids until the identity/customer registry tasks; and the gateway is the fake adapter — real Stripe/PayPal adapters implement the existing `PaymentGateway` port.

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

### 2026-06-12 (Phase 3 / User Story 1)

- Completed T015-T026 (tenant publishes a complete bookable operation), tests first:
  - Domain: scheduling time primitives with Intl-based DST-safe timezone conversion (`packages/domain/src/scheduling/time.ts`); provider schedules with weekly windows, breaks, day-off and special-day overrides (`providers/provider.ts`); catalog entities with duration/buffer/capacity rules (`catalog/service.ts`); tenant aggregate with branding, locale, timezone, and booking policies (`tenancy/tenant.ts`).
  - Application: availability engine v1 (pure function over windows, buffers, extras, provider busy intervals, and shared resource allocations), availability service with single-provider auto-selection, tenant admin service, and catalog service, all emitting domain events + audit records through an EventSink port.
  - Delivery: Fastify API (`services/api/src/api/availability-routes.ts`) with per-request tenant resolution from the Host header (platform/admin/public route groups), and a minimal Next.js 15 admin app (`apps/admin`) with the tenant-setup feature and widget availability preview; `next build` passes.
  - Infrastructure: in-memory repository adapter implementing the tenant and catalog ports for tests and local dev.
  - Tests: 17 unit (schedule resolution incl. DST and per-provider timezones; duration/capacity rules), 4 integration (shared resource with quantity 1 blocks competing services across providers, buffers included), 4 e2e over HTTP (single-provider widget omits selection and auto-assigns; second provider flips it to required; unknown hosts rejected; audit events recorded). Full suite: 34 passing.
- All three US1 acceptance scenarios from `spec.md` are covered by automated tests.

### 2026-06-12 (Phase 4 / User Story 2)

- Completed T027-T040 (customer books, pays, and receives transactional confirmation), tests first:
  - Domain: booking aggregate with the state machine (pending -> approved/rejected/expired; approved -> canceled/rescheduled; terminal states closed) in `packages/domain/src/bookings/booking.ts`; packages, coupons, cart transactions, and per-booking subpayments with reconcilability invariants in `payments/payment.ts`.
  - Application: pricing service (base x attendees, extras with per-person multiplication, package then coupon discounts, taxes, percent/fixed deposits — integer minor units); checkout lock service with ownership tokens over a LockStore port; booking service with audited transitions; cart reconciliation service (one gateway charge per cart, exact per-booking refunds, derived cart status).
  - Integrations: new `packages/integrations` with the `PaymentGateway` adapter boundary and a deterministic fake gateway (idempotent charges, failure injection).
  - Infrastructure: Redis lock store (SET NX PX + compare-and-delete Lua) and in-memory equivalent; webhook idempotency processor (at-most-once per tenant+gateway, audited).
  - Delivery: `POST /v1/public/checkout` (slot validation against the engine -> locks -> pending booking -> cart charge) and `POST /v1/public/payments/webhook` (idempotent approval/rejection + lock release + occupancy recording); `apps/booking-widget` Next.js app with the checkout feature (`next build` passes).
  - Tests: 12 unit (duration formula, state machine, pricing), 8 integration (Redis lock concurrency/TTL/ownership/tenant-scoping against real Redis; cart reconciliation + webhook idempotency), 3 e2e over HTTP (pending -> webhook approval -> slot disappears from availability; declined charge -> rejected booking + lock release; off-schedule slot rejected). Full suite: 58 passing.

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
T041 Add tests for minimum cancel/reschedule windows and rejected attempts (Phase 5 / User Story 3)
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
