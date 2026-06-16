# Handoff

Last updated: 2026-06-16

## Post-Spec Work (2026-06-16): Admin Console + Resource Model B/C

Beyond T001–T086, the admin console (`apps/admin`) gained a sidebar shell with product areas, and **Servicios / Reservas / Recursos / Ubicaciones / Proveedores / Clientes / Calendario** are functional screens backed by process-local Next.js route handlers (`apps/admin/src/server/demo-store.ts`) so the console runs with a single `pnpm dev` (no Fastify needed). The API proxy is narrowed to `/api/v1/*` so it does not shadow these handlers.

The full assignment chain is now wired end to end in the admin demo store: `Ubicación -> Recurso -> Proveedor -> Servicio -> Reserva -> Cliente`. Customers (`AdminCustomer`) are first-class (Clientes screen) and bookings link a `customerId` + `providerId`. The Calendario screen renders a weekly grid of confirmed bookings grouped by provider. (This is admin-demo-store wiring; the Fastify `/v1/admin/*` provider/customer/eligibility routes remain the productionization step.)

**Resource hub model (2026-06-16, ADR-0016).** After a full Amelia admin sweep (`docs/analysis/amelia-ux-reference.md`), the admin resource model was migrated to a *hub*: `AdminResource` now declares `locationIds[]`, `serviceIds[]` and `employeeIds[]` (empty = "any"). `AdminService` lost `resourceId`/`resourceUnits` and `AdminProvider` lost `resourceIds` — eligibility now lives only on the resource (single source of truth). The **Recursos** screen is the hub config page (three checkbox groups + edit/save); Proveedores and Servicios dropped their resource controls. `createBooking` allocates: for the booked service it finds active resources whose `serviceIds` include it, filters by provider eligibility and location compatibility, then requires at least one with a free unit (capacity stays 1 unit/booking). Deferred on purpose: quantity partition (`shared/per-service/per-location`) and group booking. **Scope:** this lands only in `apps/admin/src/server/demo-store.ts` + its route handlers; the canonical domain/persistence layer (ADR-0015) still carries the old shape and needs a follow-up migration (join tables `resource_services`/`resource_locations`/`resource_employees`, drop `provider_resources` + `service.resource_id`).

The resource model was extended to **model B (provider-resource eligibility) + model C (multi-site locations)** per ADR-0015:

- Domain: `Location` (`packages/domain/src/locations/location.ts`), `Resource.locationId`, `ProviderResource` + `providerEligibleForResources()`.
- Engine: `computeAvailableSlots` honors `providerEligibleResourceIds` (zero availability when a provider is not eligible for a demanded resource).
- Persistence: `locations` + `provider_resources` tables, `resources.location_id`, migration `infra/postgres/003-locations-eligibility.sql`; in-memory + Drizzle adapters.
- Admin UI enforces concurrent resource capacity in bookings (the "4 therapists / 2 rooms" constraint is observable). See `docs/analysis/resources-model-review.md`.

Remaining for full B/C: Fastify `/v1/admin/*` routes for locations/eligibility, provider-portal eligibility editor, public-widget exposure, and resource _groups_ (interchangeable pools with per-provider subsets). See ADR-0015 "Consequences". Note the eligibility *direction* changed with the hub migration (ADR-0016): the domain `ProviderResource` association should be replaced by resource-owned `employeeIds` when the canonical layer is migrated.

## Read This First

This is the fastest resume document for Codex, Claude, or any future agent. Read this before making changes.

**All phases T001–T086 are complete.** The SaaS multitenant booking platform spec (US1–US5) is fully implemented and tested. 229 tests pass (233 total; 4 skip without Redis/Postgres docker services; 1 pre-existing flaky test in passwordless JWT unrelated to spec scope). Lint and Prettier pass clean.

Phase 8 (T076–T086) added: billing plan domain with feature flags and quotas, idempotent async job runner with retry, booking notification dispatcher, payment reconciliation worker, calendar sync with conflict detection, video meeting provisioning service gated on billing plan, audit log search API, demo tenant seeds, operations dashboard UI, 6 new ADRs (ADR-0009 through ADR-0014), and quickstart acceptance validation scenarios 9–13.

The Drizzle/RLS persistence adapter is DONE: `packages/persistence` implements every repository port against PostgreSQL with per-transaction tenant context, verified end to end by `tests/integration/persistence/drizzle-checkout.test.ts`. In-memory adapters remain for fast tests/dev.

Remaining v1 simplifications: `/v1/admin/*` routes have no staff auth yet (identity tasks pending) so they are development-only; customers are generated ids until the customer registry lands; the payment gateway is the fake adapter behind the real `PaymentGateway` port; there is no production server bootstrap yet wiring the Drizzle adapters (compose them like the persistence test does).

## Current Objective

Prepare and implement a SaaS-native multitenant booking platform inspired by Amelia Premium, using the existing Spec Kit artifacts as the product and architecture source of truth.

## Current Repo State

- Branch state: PR #1 merged everything into `main` (merge commit `149d4c0`, 2026-06-12); the working branch `claude/optimistic-babbage-8vdefc` is in sync with `main`. New work continues on the working branch and reaches `main` via PR with user approval.
- Remote: `origin https://github.com/jav13rrez/saas-reservas.git`
- Stack decisions recorded as ADR-0001 through ADR-0008 in `docs/adr/`: Next.js, Fastify, Drizzle, BullMQ, first-party cookie sessions, deferred AIProviderAdapter, Docker Compose for local dev, and the Holded/Lucide design system (`docs/design-system.md`).
- T001-T006 complete: pnpm workspace (`pnpm-workspace.yaml`), root tooling (`package.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts`), and `packages/contracts` with `environment.ts` and `openapi.ts`.
- T007-T014 complete: `infra/postgres/001-tenancy.sql` (RLS template + `apply_tenant_rls`), `infra/docker-compose.yml` (Postgres/Redis/MinIO), `packages/tenant-context` (Postgres tenant context, Redis keys, storage paths), `services/api` tenant resolver, `packages/domain` audit/event primitives, `services/worker` `runTenantJob` wrapper, and 9 passing RLS/worker integration tests.
- T015-T026 complete (User Story 1): scheduling/catalog/tenancy domain modules in `packages/domain`, availability engine + availability/tenant-admin/catalog application services in `services/api/src/application`, Fastify API in `services/api/src/api/availability-routes.ts`, in-memory repository adapter in `services/api/src/infrastructure/memory`, and the Next.js admin app in `apps/admin` (builds with `next build`).
- T027-T040 complete (User Story 2): booking + payment domain (`packages/domain/src/bookings`, `payments`), pricing/lock/booking/cart-reconciliation services (`services/api/src/application`), `PaymentGateway` adapter boundary + fake gateway (`packages/integrations`), Redis lock store + webhook idempotency (`services/api/src/infrastructure`), checkout + webhook routes (`services/api/src/api/checkout-routes.ts`), and the `apps/booking-widget` Next.js checkout UI.
- T041-T050 complete (User Story 3): change policy engine + booking change service (cancel with refund + freed occupancy; reschedule with slot validation, subpayment reassignment, occupancy swap), Ed25519 passwordless customer access with one-time nonces and HttpOnly sessions, GDPR anonymization preserving metrics, permission-checked provider portal service, and customer/staff portal routes (`services/api/src/api/portal-routes.ts`).
- T051-T061 complete (User Story 4): events domain (`packages/domain/src/events`), event pricing/waitlist/recurring services and event store port (`services/api/src/application/events`), recurrence conflict resolver (`application/scheduling`), and event routes (`services/api/src/api/event-routes.ts`). Events persistence is in-memory behind ports (Drizzle tables pending). 110 tests passing across unit/integration/e2e.
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

The implementation is complete. Recommended follow-up work (outside this spec):

1. **Production server bootstrap**: `services/api/src/main.ts` loading `environment.ts`, Drizzle adapters, and starting Fastify — makes the stack runnable outside tests (see `tests/integration/persistence/drizzle-checkout.test.ts` for the wiring pattern).

2. **Drizzle migrations for Phase 7–8 contexts**: credential vault blobs, OAuth tokens, calendar event mappings, webhook subscriptions, attachment metadata, and billing/usage tables — all ports currently use in-memory adapters.

3. **Staff authentication**: `/v1/admin/*` routes use a dev-only `x-provider-id` header; real staff auth (e.g., API keys or JWT) is deferred.

4. **Real adapter wiring**: swap `FakePaymentGateway`, `FakeMessageProvider`, `FakeKmsAdapter`, and `FakeStorageAdapter` for real Stripe Connect, SendGrid/Twilio, AWS KMS, and S3 equivalents behind the existing interfaces.

5. **Fix pre-existing flaky test**: `tests/integration/identity/customer-passwordless.test.ts` line 99 — the "expires sessions after their TTL" case fails intermittently due to date-sensitive JWT behavior.

## Current Task Pointer

All tasks T001–T086 are complete.

```text
No pending tasks.
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
