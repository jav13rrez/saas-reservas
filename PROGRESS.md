# Progress

Last updated: 2026-06-16

## Current State

Implementation has started. Stack decisions are recorded as ADRs; Phases 1-6 (T001-T061) are complete: tenant-safe foundations, User Story 1 (publishable bookable operation), User Story 2 (transactional checkout), User Story 3 (policy-guarded changes, portals, GDPR), and User Story 4 (events with tickets, dynamic pricing, recurrence propagation, and TTL-token waitlist). 110 tests passing across unit/integration/e2e, including suites against real PostgreSQL (RLS) and real Redis (locks).

The Drizzle/RLS persistence adapter (`packages/persistence`) is built and verified: every repository port (tenants, catalog, bookings, carts, events/audit, webhook idempotency, checkout holds, occupancy) has a Postgres implementation that binds `app.current_tenant_id` per transaction, and the full checkout flow passes against real PostgreSQL with cross-tenant RLS proven. The in-memory adapters remain for fast tests and local dev without a database.

Remaining v1 simplifications: `/v1/admin/*` routes have no staff auth yet (identity tasks pending) so they are development-only; customers are generated ids until the identity/customer registry tasks; the gateway is the fake adapter — real Stripe/PayPal adapters implement the existing `PaymentGateway` port; and there is no production server bootstrap yet that wires the Drizzle adapters (tests compose them directly).

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

### 2026-06-12 (merge to main)

- Opened and merged PR #1 with the owner's approval: all work from Phases 1-6 (8 commits — ADRs, foundations, US1-US4, Drizzle/RLS persistence, design system) is now on `main` (merge commit `149d4c0`). The working branch stays in sync with `main`; future work merges via PR.

### 2026-06-12 (design system)

- Defined the product design system at the owner's direction: Holded-inspired light UI, Lucide-only iconography, and a hard no-emoji rule for product UI and user-facing strings. Recorded as ADR-0008 with the full guide in `docs/design-system.md`.
- Implemented `packages/ui` with the tokens as code (`tokens.css` CSS custom properties + `tokens.ts` constants, including the booking/payment status color mapping). Both Next.js apps now import the tokens and `lucide-react` (Building2 in admin, CalendarDays in the widget); both build. Tenant branding overrides `--ui-color-primary` at runtime.
- The rule is binding for future UI work and is written into `CLAUDE.md`/`AGENTS.md`; a future `assets/icons/` folder may add brand-owned icons behind the same conventions.

### 2026-06-12 (Phase 6 / User Story 4)

- Completed T051-T061 (events, tickets, recurrence, waitlist), tests first:
  - Domain (`packages/domain/src/events/event.ts`): events with shared capacity pools, ticket types with optional per-ticket caps and dynamic pricing rules, attendees, series, and the waitlist state machine (waiting -> offered -> approved; offered -> expired).
  - Event pricing (T057): early-bird discounts by days-before-start and occupancy surcharges past a sold percentage, applied discount-then-surcharge on integer minor units.
  - Waitlist service (T058): priority-ordered promotion with TTL claim tokens (only the SHA-256 stored), single-use claims, and `expireOffers` that expires stale offers and auto-promotes the next candidate (worker-job shaped).
  - Recurring events (T060): "this-only" vs "this-and-future" propagation with all-or-nothing validation and per-instance audit; earlier instances never touched.
  - Recurring appointments (T059): conflict resolver with "omit" and "suggest" (nearest same-day slot) strategies over an injected availability lookup.
  - Routes (T061): admin events/tickets/series-PATCH and public event detail (priced tickets, remaining capacity), purchases (sold out -> 409 + waitlist enrollment), attendee cancel (auto-promotion with TTL token), and claim endpoint.
  - Tests: 13 unit (capacity, pricing, recurrence conflicts) + 8 integration (waitlist promotion/TTL, series propagation) + 5 e2e (sell out -> waitlist -> cancel -> promote -> claim, plus scope propagation over HTTP). Full suite: 110 passing.
- Events persistence is in-memory behind the `EventStore`/`WaitlistStore` ports; Drizzle tables for the events context are a known follow-up.

### 2026-06-12 (Phase 5 / User Story 3)

- Completed T041-T050 (staff and customers manage changes under policies and privacy), tests first:
  - Change policy engine (T045): pure decision over booking status, per-action minimum notice hours, and start time; out-of-window or started bookings are rejected without side effects.
  - Booking change service (T048): policy -> state machine -> money -> occupancy. Cancel refunds the subpayment (via a PaymentSettlement port over cart reconciliation) and frees the slot; reschedule validates the new slot against the availability engine, marks the old booking rescheduled, creates the approved replacement, re-points the subpayment, and swaps occupancy. Occupancy is now keyed by booking id (`releaseBookingOccupancy`), with idempotent SQL migration updates.
  - Customer passwordless access (T046): Ed25519-signed short-lived JWTs with one-time nonces (first-use revocation, replay/tamper/expiry rejection) exchanged for opaque HttpOnly+Secure session cookies, tenant-bound (ADR-0005).
  - GDPR anonymization (T049): profile PII irreversibly replaced, bookings/payments metrics preserved, audited without leaking erased data, idempotent. `customers` table added to migration/schema with Drizzle repository methods.
  - Provider portal service (T047): permission-checked self-service (manage-own-schedule, manage-own-bookings, view-customer-contact gating customer linkage).
  - Portal API (T050): customer routes (access link dev-only, session redeem with Set-Cookie, list/cancel/reschedule own bookings, GDPR self-erasure) and staff routes (schedule + bookings; dev-only x-provider-id identification until staff auth lands).
  - Tests: 5 unit (policy windows) + 13 integration (cancellation/refund audit incl. reschedule conflict, passwordless security properties, GDPR) + 5 e2e (full portal flow over HTTP). Full suite: 84 passing.

### 2026-06-12 (persistence adapter)

- Built `packages/persistence`, the Drizzle/RLS adapter that replaces the in-memory stores for real deployments (ADR-0003):
  - `infra/postgres/002-domain.sql`: all domain tables (catalog, schedules, bookings, carts, subpayments, domain events, audit records, processed webhooks, provider busy, resource allocations, checkout holds) with `apply_tenant_rls` on every tenant-owned table; `tenants` extended with timezone/locale/branding/policies; `tenant_domains` stays platform-global for pre-context routing.
  - `TenantDb.withTenant`: every repository call runs in a transaction that binds `app.current_tenant_id` first; platform tables use `global`.
  - Drizzle repositories for every port: tenant registry + resolver lookup, catalog read/write incl. the availability read model, bookings, carts/subpayments, event sink (outbox + audit in one transaction), atomic webhook idempotency (PK + ON CONFLICT DO NOTHING), durable checkout holds, and occupancy recording.
  - Checkout routes now use a `HoldStore` port (in-memory default, Drizzle implementation) instead of a process-local Map, so webhooks arriving after a restart still settle bookings.
  - Integration test `tests/integration/persistence/drizzle-checkout.test.ts`: the full US1+US2 flow over HTTP against real PostgreSQL — tenant setup, catalog, availability, checkout, idempotent webhook approval, persisted occupancy removing the slot, audit trail per tenant, and RLS proving a booking id is invisible under another tenant's context. Full suite: 61 passing.

### 2026-06-13 (Phase 7 / User Story 5)

- Completed T062–T075 (premium integrations operate securely and at scale), tests first:
  - Credential vault (T067/T062): `packages/integrations/src/security/credential-vault.ts` — AES-256-GCM envelope encryption, per-tenant/provider/key scoping, `InMemoryKmsAdapter` XOR-wraps DEK, `InMemoryVaultStorage`, tamper detection via GCM auth tag, and `redactedRef` for log-safe references. 14 integration tests.
  - Calendar OAuth gateway (T069/T063): `packages/integrations/src/calendar/calendar-oauth-gateway.ts` — platform-shared and tenant-owned credential modes, authorization URL construction, code exchange, token refresh with fallback to stored refresh token, revocation, and `FakeHttpAdapter`. 9 contract tests.
  - WhatsApp Cloud (T072/T065): `packages/integrations/src/notifications/whatsapp-cloud.ts` — health check, template sync, message dispatch with placeholder substitution, and `FakeWhatsAppHttp`. 9 contract tests.
  - Message provider (T073): `packages/integrations/src/notifications/message-provider.ts` — `MessageProvider` interface + `FakeMessageProvider` with capture and failure injection.
  - Video meeting adapter (T071): `packages/integrations/src/meetings/meeting-provider.ts` — `MeetingProvider` interface + `FakeMeetingProvider` for Google Meet, Zoom, and Teams.
  - Stripe Connect (T068): `services/api/src/application/payments/stripe-connect-service.ts` — Express/Standard connected account creation with onboarding link, account status polling, basis-point application fee calculation, and `FakeStripeHttp`. 10 contract tests.
  - Calendar webhook routes (T070/T064): `services/api/src/api/calendar-webhook-routes.ts` — Google sync handshake + HMAC-signed channel-token validation; Microsoft validation handshake + clientState verification; idempotency via `NotificationIdempotencyStore`; wired into `buildApp` as optional `calendarWebhooks` dep. 10 integration tests.
  - Attachment service (T074/T066): `services/api/src/application/files/attachment-service.ts` — ordered pipeline (MIME → size → quota → antivirus → upload), `tenants/{id}/attachments/...` storage paths, filename sanitization, signed URL generation, deletion with quota decrement, `FakeAntivirusAdapter`, `FakeStorageAdapter`, `InMemoryQuotaStore`. 12 integration tests.
  - Outbound webhook dispatcher (T075): `services/worker/src/jobs/outbound-webhook-dispatcher.ts` — HMAC-SHA256 `X-Signature-256` header, exponential backoff (3 attempts × 4× factor), tenant+event-scoped subscription store, `FakeHttpDispatcher`. 10 contract tests. Worker package.json updated to wildcard export.
  - Full suite: 168 passing, 4 skipped (Redis/Postgres not available in CI container — by design). Lint and Prettier clean.

### 2026-06-15 (Phase 8 / final push)

- Completed T076–T086 (billing, operations, worker hardening, ADRs, acceptance validation):
  - Billing domain (T076): `packages/domain/src/billing/billing.ts` — `FeatureFlag` union type, `BillingPlan`, `BillingQuotas`, `TenantBilling`, `TenantUsage`, `UsageEvent`; domain logic `hasFeature`, `isWithinQuota`, `bookingQuotaRemaining`; three built-in plans STARTER (€29), PROFESSIONAL (€79), ENTERPRISE (€299). 11 unit tests.
  - Worker job runner (T080): `services/worker/src/infrastructure/jobs/job-runner.ts` — `TenantJobPayload`, idempotency store port + in-memory implementation, configurable retry with exponential back-off (`DEFAULT_JOB_RETRY`: 3 attempts, 2 s base, ×3), `runJob` orchestrator binding tenant context before handler. 13 unit tests.
  - Booking notification dispatcher (T081): `services/worker/src/jobs/booking-notification-dispatcher.ts` — channel selection (SMS when phone present, else email), message builder per event type (confirmed/cancelled/rescheduled/reminder/rejected), meeting join URL injection. 9 integration tests.
  - Payment reconciliation (T082): `services/worker/src/jobs/payment-reconciliation.ts` — `reconcilePayments` compares internal records vs Stripe charges, classifies as `ok / amount_mismatch / missing_in_stripe / duplicate_capture / status_mismatch`. `FakeStripeChargeRepository` for tests. 6 integration tests.
  - Calendar sync (T083): `services/worker/src/jobs/calendar-sync.ts` — `syncCalendar` upserts remote events, counts cancellations, O(n²) conflict detection (confirmed non-all-day events only). `FakeRemoteCalendarAdapter` + `FakeLocalCalendarStore`. 6 integration tests.
  - Videomeeting provisioning (T084): `services/api/src/application/integrations/videomeeting-provisioning-service.ts` — gates on `hasFeature("video_meetings")`, delegates to `MeetingProvider`, persists in `MeetingRepository`; supports provision/update/cancel/getDetails. `InMemoryMeetingRepository` for tests. 10 integration tests.
  - Audit log routes (T078): `services/api/src/api/audit-routes.ts` — GET `/audit/events` with tenant-scoped filtering (actorId, eventType, date range), pagination; `InMemoryAuditLogRepository`. 7 integration tests.
  - Demo seeds (T079): `services/api/src/seeds/demo-tenants.ts` — deterministic seed data for 3 tenants (Starter/Pro/Enterprise) with providers, services, and bookings; `SeedStore` port for adapter injection.
  - Operations dashboard (T077): `apps/admin/src/features/operations/index.tsx` — React UI with tenant grid (billing status badges, quota bars for bookings/storage/notifications), click-through audit log panel; no emojis, Lucide icons only.
  - ADRs (T085): 6 new decision records (ADR-0009 through ADR-0014) covering PostgreSQL RLS, Redis distributed lock, payment reconciliation strategy, OAuth gateway design, worker idempotency, and GDPR data handling.
  - Quickstart acceptance (T086): `specs/001-saas-multitenant-booking/quickstart.md` extended with Scenarios 9–13 (billing feature gates, worker idempotency, payment reconciliation, calendar sync conflict detection, credential vault); acceptance status table for all 13 scenarios.
  - Full suite: 229 passing, 4 skipped (Redis/Postgres not available in CI — by design); 1 pre-existing failure in `customer-passwordless.test.ts` (date-sensitive JWT test unrelated to Phase 8). Lint and Prettier clean.
  - **All T001–T086 complete. The SaaS multitenant booking spec (US1–US5) is fully implemented.**

### 2026-06-16 (Amelia UX sweep + admin connected chain + resource hub model)

- Wired the admin console's full assignment chain end to end in the process-local demo store (`apps/admin`): Ubicaciones → Recursos → Proveedores → Servicios → Reservas → Clientes → Calendario, all backed by Next.js route handlers so the console runs with a single `pnpm dev`. Customers became first-class; bookings carry `customerId` + `providerId`; the Calendario screen renders a weekly grid grouped by provider.
- Completed a full sweep of the Amelia Premium admin console and recorded it as a permanent UX reference (`docs/analysis/amelia-ux-reference.md`): all 14+ areas including Dashboard, Calendar, Bookings, Employees, Events, Catalog (Services/Resources/Packages), Locations, Customers, Finance, Notifications, Customize, Custom Fields, Features & Integrations, and Settings (General/Company/Payments/Bookings/Roles & permissions).
- **Migrated the admin resource model to a hub (ADR-0016):** `AdminResource` now declares `locationIds[]`/`serviceIds[]`/`employeeIds[]` (empty = "any"); `AdminService` dropped `resourceId`/`resourceUnits` and `AdminProvider` dropped `resourceIds` — eligibility lives only on the resource (single source of truth). `createBooking` allocates an eligible, location-compatible resource with spare capacity (1 unit/booking). Recursos screen rebuilt as the hub config page; Proveedores/Servicios dropped their resource controls. `tsc --noEmit` clean. Quantity partition and group booking deferred on purpose (registered in the reference doc's "Decisiones pendientes" and ADR-0016). Scope is the admin demo store; the canonical domain/persistence layer (ADR-0015) still needs the matching migration.

### 2026-06-17 (canonical resource-hub migration — additive)

- Migrated the canonical domain/persistence layer to the ADR-0016 resource hub as
  an **additive, non-destructive** change (compatibility preserved; nothing dropped):
  - Domain: `packages/domain/src/catalog/resource-hub.ts` with pure helpers
    (`resourceServesService`, `resourceAllowsProvider`,
    `resourceCompatibleWithLocations`, `hubResourcesForBooking`) mirroring the
    admin store's empty-array "any" semantics for locations/employees and
    "none" for services.
  - Persistence: SQL migration `infra/postgres/004-resource-hub.sql` adding the
    resource-owned join tables `resource_services` / `resource_locations` /
    `resource_employees` (RLS, idempotent), mirrored in
    `packages/persistence/src/schema.ts`; new `DrizzleResourceHubRepository`.
  - Application: `ResourceHubRepository` port + audited `ResourceHubService`
    (`services/api/src/application/catalog/resource-hub-service.ts`), implemented
    by both the in-memory adapter (`InMemoryStore`) and the Drizzle adapter.
  - Legacy ADR-0015 model B (`service_resources`, `provider_resources`,
    `resources.location_id`, `providerEligibleForResources`) is retained and still
    drives the availability engine; the engine/widget/Fastify cutover and the
    eventual destructive drop are the remaining follow-up.
  - Tests: 11 unit (`tests/unit/catalog/resource-hub.test.ts`) + a shared-contract
    integration suite (`tests/integration/catalog/resource-hub.test.ts`) over the
    in-memory adapter (always) and Drizzle/RLS (self-skips without PostgreSQL).
    The domain-db fixture now applies migrations 003 + 004 and grants/cleans the
    new tables. Full suite: 253 passing, 5 skipped (no Redis/Postgres), 1
    pre-existing flaky (`customer-passwordless` TTL). Typecheck, lint, Prettier clean.

### 2026-06-17 (hub read-model cutover)

- Pointed the canonical read path at the hub (ADR-0016), keeping the engine intact:
  - `AvailabilityService` now takes a `ResourceHubRepository`; the resources serving
    a service form an interchangeable pool collapsed into one synthetic engine
    demand (`services/api/src/application/scheduling/hub-resources.ts`,
    `HUB_POOL_RESOURCE_ID`) — quantity = Σ candidate quantities, allocations = union.
    No serving resource → no constraint; resources but provider eligible for none →
    zero availability. The availability engine is unchanged; the legacy model-B
    inputs remain and are still covered by `resource-conflicts.test.ts`.
  - `checkout-routes` and `BookingChangeService` (reschedule) allocate one eligible,
    location-compatible pool resource with a free unit (iterating candidates), via a
    new `hub` dependency.
  - Fastify admin hub routes (optional `resourceHub` dep in `buildApp`): `PUT
    /v1/admin/resources/:id/{services,locations,employees}`, `GET
    /v1/admin/resources/:id/hub`.
  - New `tests/integration/scheduling/hub-availability.test.ts` proves pool capacity
    ("2 rooms") and eligibility-zero. Also fixed `customer-passwordless` flaky test
    (nonce expiry now honors the injected clock). Suite: 257 passing, 5 skipped, 0
    failures. Typecheck and lint clean.
  - Known limitation: hub location compatibility is a no-op until the canonical
    `Provider` gains locations (it never wrongly blocks).

### 2026-06-17 (provider locations + legacy model-B drop)

- Completed the hub migration end to end:
  - Provider locations (canonical): `provider_locations` join table
    (`infra/postgres/005-provider-locations.sql` + `providerLocations` in
    `schema.ts`), `CatalogRepository.{setProviderLocations,listProviderLocationIds}`
    on both adapters, `CatalogService.setProviderLocations`, and Fastify `PUT
    /v1/admin/providers/:id/locations`. Availability/checkout/reschedule now feed
    the provider's locations into `hubCandidates`, making hub location
    compatibility real (empty on either side still means "any"). New test case in
    `hub-availability.test.ts` proves Centro/Norte compatibility.
  - Destructive migration `infra/postgres/006-drop-legacy-resource-model.sql`
    drops `provider_resources` and `service_resources`; removed all their plumbing
    (domain `ServiceResource`/`ProviderResource`/`providerEligibleForResources`,
    the four `CatalogRepository` model-B methods on both adapters, the Drizzle
    table defs, and the `POST /v1/admin/services/:id/resources` route). The
    availability engine is untouched (`resource-conflicts.test.ts` still green).
  - Suite: 254 passing, 5 skipped, 0 failures. Typecheck and lint clean.
  - Follow-up (same day): dropped `resources.location_id`
    (`infra/postgres/007-drop-resource-location-id.sql`) and removed it from the
    domain `Resource` and Drizzle schema; multi-site placement now lives entirely
    in `resource_locations`. The hub is the complete and sole resource model with
    no legacy remnants.

### 2026-06-17 (staff authentication for /v1/admin/*)

- Implemented staff auth (ADR-0005, recorded in ADR-0017), replacing the
  `SYSTEM_ACTOR` placeholder on `/v1/admin/*`:
  - `staff_accounts` table (`008-staff-accounts.sql`, RLS, unique tenant+email),
    `staffAccounts` in `schema.ts`, `StaffAccountStore` port with in-memory and
    Drizzle (`DrizzleStaffAccountRepository`) adapters.
  - `StaffAuthService` + scrypt password hashing (`application/identity/`):
    create account, authenticate → opaque `staff_session` HttpOnly cookie (8h),
    tenant-bound `getSession`, logout. Failed logins verify against a placeholder
    hash for uniform timing. Account creation and login are audited.
  - `buildApp` gains an optional `staffAuth`; when set, `/v1/admin/*` requires an
    admin session (401/403) and the audit actor is the staff member. Routes:
    `POST/DELETE /v1/admin/sessions`, `POST /v1/admin/staff`,
    `POST /v1/platform/tenants/:id/staff` (bootstrap). `main.ts` wires it; fast
    tests opt out so they stay unchanged.
  - Tests: `tests/unit/identity/password.test.ts` + `tests/e2e/staff-auth.test.ts`.
    Suite: 261 passing, 5 skipped, 0 failures. Typecheck and lint clean.
  - Deviations/follow-ups (ADR-0017): scrypt instead of argon2 (no native build),
    in-memory session map (per-process), login rate limiting and staff-portal
    migration pending.

## Current Backlog

All tasks T001–T086 are complete. The implementation covers the full spec for the SaaS multitenant booking platform.

Primary implementation backlog:

```text
specs/001-saas-multitenant-booking/tasks.md
```

Current task count:

```text
T001-T086 — ALL COMPLETE
```

Current next task:

```text
None — production deployment and real adapter wiring are deferred per ADR-0007.
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
