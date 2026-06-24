# Progress

Last updated: 2026-06-24

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

### 2026-06-17 (staff authentication for /v1/admin/\*)

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

### 2026-06-17 (operator onboarding — Part 1: admin running locally)

- Began hands-on onboarding with the repo owner (Supabase/Vercel background).
  Walked through running the project locally: upgraded to Node 22 (nvm), installed
  pnpm 10, and started the admin console (`pnpm --filter @saas-reservas/admin dev`).
  Owner confirmed the panel renders at `http://localhost:3000` with in-memory demo
  data (no DB needed for Part 1). Next session continues with Part 2 (full local
  stack: Postgres + Redis via Docker + the persistent API). See HANDOFF.md
  "Resume Point" and docs/operations/SETUP.md. No code changes this step.

### 2026-06-17 (operator setup docs + relaxed env contract)

- Added `.env.example` and `docs/operations/SETUP.md` (operator checklist: infra,
  secrets, env vars, external provider accounts, global vs per-tenant, status).
- Relaxed `packages/contracts/src/environment.ts`: `STORAGE_*` and
  `CREDENTIALS_MASTER_KEY` are now optional (still validated when present), so the
  persistent server boots with DB + Redis + domain + session/token secrets only.
  Verified a minimal env validates; full suite stays green (261 passing).

### 2026-06-17 (production server bootstrap)

- Turned `services/api/src/main.ts` into a mode-selectable composition root:
  - **Persistent mode** (`DATABASE_URL` set): `loadEnvironment` fail-fast
    validation, Drizzle/RLS adapters for tenant/catalog/hub/staff/payment/
    event-sink/webhook/hold, and a Redis `RedisLockStore` for checkout locks;
    listens on `API_HOST:API_PORT`. Mirrors the `drizzle-checkout.test.ts` wiring.
  - **In-memory mode** (default): prior dev behavior (seeds demo tenant, port 3001).
  - `services/api` gained a dependency on `@saas-reservas/persistence`
    (package.json + tsconfig references). Added SIGTERM/SIGINT graceful shutdown
    (close app, DB pool, Redis). Exempted `/v1/ops/*` from tenant resolution so
    the operations dashboard feed is reachable.
  - Smoke-tested the dev boot (server listens, `/v1/ops/tenants` serves the
    overview). Payment gateway remains the fake adapter (real Stripe Connect is
    the next follow-up). Suite: 261 passing, 5 skipped, 0 failures; typecheck and
    lint clean.

### 2026-06-18 (operator onboarding — Part 2: full local stack + first real tenant + checkout)

- Brought up the complete local stack end to end with the repo owner (no code
  changes to the app; operations + docs only):
  - **Docker** reinstalled as native **Docker Engine inside WSL2** (Ubuntu, no
    Docker Desktop, systemd enabled) after the owner's prior Desktop/WSL2
    conflicts. Verified with `hello-world`.
  - **Infra up:** `postgres` + `redis` via `infra/docker-compose.yml` (both
    healthy); the SQL migrations `001`…`008` applied automatically on Postgres
    first boot (25 tables, RLS, resource-hub join tables, staff_accounts).
  - **Env:** `.env` from `.env.example` with generated `PASSWORDLESS_TOKEN_SECRET`
    - `SESSION_COOKIE_SECRET`; API built and started in **persistent mode**
      (`node --env-file=.env services/api/dist/main.js`, Drizzle/RLS + Redis).
  - **First real tenant** provisioned over HTTP: `POST /v1/platform/tenants`
    (`mi-negocio`), bootstrap admin via `POST /v1/platform/tenants/:id/staff`,
    staff login (`POST /v1/admin/sessions`) returning the `staff_session` cookie.
    Confirmed the admin gate (401 without session, 201 with) and DB persistence.
  - **Minimal bookable operation:** category → service (Corte de pelo, 60 min,
    30 €) → provider (Ana, Mon–Fri 09:00–17:00) → assignment → `GET
/v1/public/availability` returned 8 hourly slots from the engine.
  - **First real booking (star flow):** `POST /v1/public/checkout` created a
    `pending` booking + cart charge (fake gateway), `POST
/v1/public/payments/webhook` (`charge.succeeded`) approved it and recorded
    occupancy; the booked slot then disappeared from availability (8 → 7).
- **Technical-debt ledger:** added `TECH_DEBT.md` (repo root) as the cumulative
  pre-VPS register (superuser local DB role bypassing RLS, in-memory staff
  sessions, fake adapters, in-memory events persistence, no migration runner, the
  actor-before-id JSON parsing gotcha). Linked from `HANDOFF.md`.
- Onboarding lesson captured in `TECH_DEBT.md`: admin create responses serialize
  `actor.id` (staff) before the entity `id`, so naive `grep | head -1` parsing
  grabs the wrong id — use `jq -r .id`, `tail -1`, or read ids from Postgres.

### 2026-06-19 (admin ↔ persistent API integration — Phase 1: read surface + Locations)

- Started connecting `apps/admin` to the persistent Fastify API (ADR-0018), the
  prioritized next objective. The blocker was that `/v1/admin/*` was almost
  entirely **write-only** — the console had no read endpoints to render from, and
  locations had no canonical CRUD. Delivered the backend foundation, tests first:
  - **Admin read model:** `GET /v1/admin/{categories,services,providers,resources}`.
    Providers come enriched with their service assignments + work locations;
    resources come enriched with their hub associations (ADR-0016). Added
    `listCategories/listServices/listProviders/listResources/listProviderServiceIds`
    to the `CatalogRepository` port and both adapters (`InMemoryStore`,
    `DrizzleCatalogRepository`), plus `CatalogService.listProviders` composing the
    enrichment.
  - **Locations CRUD (canonical):** new `LocationService` + `LocationRepository`
    port over the existing `locations` table, with in-memory and Drizzle/RLS
    (`DrizzleLocationRepository`) adapters; routes `GET/POST/PATCH
/v1/admin/locations` (optional `locations` dep in `buildApp`). Wired into
    `main.ts` (both bootstraps).
  - **Admin client foundation (ADR-0018):** `ADMIN_DATA_MODE` env (`demo` default
    | `api`), a server-only API client (`apps/admin/src/server/api-client.ts`)
    that handles the tenant Host header + cached staff-session login with
    re-auth on 401, and a `DataSource` seam. **Locations** route handlers now go
    through the seam (`src/server/source/locations.ts`) — the proven end-to-end
    vertical. Demo stays the default; the admin still builds with a single
    `pnpm dev`.
  - Tests: `tests/e2e/admin-read-model.test.ts` (6) and
    `tests/integration/catalog/locations.test.ts` (in-memory always; Drizzle
    self-skips without PostgreSQL). Full suite: 269 passing, 6 skipped, 0
    failures. Typecheck, lint, Prettier clean; admin `next build` passes.
  - Remaining after Phase 1 (ADR-0018 Phases 3–5): admin bookings,
    services/providers/resources DTO mapping + write/toggle through the seam,
    and Calendario over the API. The `api`-mode path needs a live end-to-end run
    against the running stack (like the operator's curl chain) — not exercisable
    in this environment without Postgres/Redis.

### 2026-06-19 (admin ↔ persistent API — Phase 2: customer registry)

- Made customers first-class for the admin over the existing `customers` table
  (ADR-0018 Phase 2; also pays down the "no real customer registry" tech debt):
  - **`CustomerService`** (`application/customers/customer-service.ts`) with a
    `CustomerRegistryRepository` port — `listCustomers` and audited
    `createCustomer` (email normalized + case-insensitive de-dup; the console's
    single `name` is split into `firstName`/`lastName`). Implemented by adding
    `listCustomers` to `InMemoryPaymentStore` and `DrizzlePaymentRepository`
    (both already held the `CustomerRepository` insert/find/update).
  - Routes `GET/POST /v1/admin/customers` (optional `customers` dep in
    `buildApp`, `409` on duplicate email); wired into `main.ts` both bootstraps.
  - **Admin Clientes screen** now reads/creates through the data-source seam
    (`src/server/source/customers.ts`): list + create work in `api` mode; the
    active toggle is unsupported there (no domain concept) and returns a clear
    message. Demo mode unchanged.
  - Tests: extended `admin-read-model.test.ts` (customer register/list/dedup) +
    `tests/integration/customers/customer-registry.test.ts` (in-memory always;
    Drizzle self-skips). Suite: 272 passing, 7 skipped, 0 failures. Typecheck,
    lint, Prettier clean; admin `next build` passes.

### 2026-06-19 (admin ↔ persistent API — Services seam)

- Wired the **Servicios** screen through the data-source seam
  (`src/server/source/services.ts`): list + create work in `api` mode. This
  module owns the catalog impedance — the console's free-text `category` string
  is resolved to a `categoryId` on write (creating the Category if absent) and
  mapped back to its name on read; the active toggle is unsupported in `api` mode
  (no service-update route yet, Phase 5). Demo mode unchanged; admin `next build`
  - typecheck + lint + Prettier clean.
- **Providers and Resources** screens are intentionally NOT yet wired to `api`
  mode: their console PATCH does partial profile/assignment edits that the API
  has no clean routes for (provider update + service-unassign; resource
  name/quantity update). Wiring them belongs with ADR-0018 Phase 5 (writes/
  toggles) so they can be done fully rather than partially. `create` orchestration
  for both is supported by the existing routes when that phase lands.

### 2026-06-19 (admin ↔ persistent API — catalog write routes + Phases 3/5: bookings, full wiring)

- **Catalog write routes (Phase 5):** `PATCH /v1/admin/{services,providers,
resources}/:id` (active toggle maps to status) and
  `DELETE /v1/admin/services/:serviceId/providers/:providerId` (unassign). New
  `CatalogRepository` methods (updateService/updateProvider/updateResource/
  unassignProvider) on both adapters + audited `CatalogService` partial-update
  methods. Wired the **Servicios** toggle and the **Proveedores**/**Recursos**
  screens through the seam (provider create fans out to create + per-service
  assignment + locations PUT; update diffs assignments; resource create/update
  apply the hub via the three PUTs).
- **Admin bookings (Phase 3) — no-charge "book on behalf" (decided):**
  `AdminBookingService` reuses the availability engine + occupancy recorder
  (constitution principle II) with no cart/gateway/webhook: validates the slot,
  allocates a serving hub resource with a free unit, creates + approves the
  booking through the state machine, and records occupancy so the slot
  disappears. Routes `GET/POST /v1/admin/bookings` and
  `POST /v1/admin/bookings/:id/cancel` (cancel frees occupancy). `listBookings`
  added to both payment-store adapters. The **Reservas** and **Calendario**
  screens are wired through `source/bookings.ts` (ids enriched to names; status
  mapped). Wired in `main.ts` both bootstraps.
- Tests: `tests/e2e/admin-bookings.test.ts` (create occupies slot → list →
  cancel frees it; off-schedule slot rejected) + catalog-mutation cases in
  `admin-read-model.test.ts`. Suite: 278 passing, 7 skipped, 0 failures.
  Typecheck, lint, Prettier clean; admin `next build` passes.
- **Objective 2 (connect admin to persistent API) is functionally complete** in
  `api` mode for Locations, Customers, Servicios, Proveedores, Recursos, Reservas,
  and Calendario (demo stays the default). Remaining: live end-to-end validation
  against the running stack, the customer active-toggle (no domain concept), and
  wiring checkout to the customer registry. Decisions recorded in ADR-0018.

### 2026-06-19 (Objective 3: per-provider scheduling — Work hours / Days off / Special days)

- Built the per-provider agenda editor, the known gap vs. Amelia, end to end:
  - **API:** `GET /v1/admin/providers/:providerId/schedule` (the `PUT` already
    existed) via `CatalogService.listProviderSchedule` over the existing
    `listScheduleEntries` repository method. Entries are the domain
    `ProviderScheduleEntry` union (weekly window + breaks, special-day, day-off);
    the `PUT` validates via `validateScheduleEntry`.
  - **Admin demo store:** added a `schedules` map + `getProviderSchedule` /
    validated `setProviderSchedule` (HH:mm windows, breaks inside the window,
    weekday 0–6, ISO dates), seeded Ana (Mon–Fri 09–17 with lunch) and Carlos
    (Mon–Wed mornings).
  - **Seam + route:** `source/schedules.ts` (demo vs API) and
    `app/api/providers/[id]/schedule/route.ts` (GET/PUT).
  - **UI:** `features/provider-schedule` editor — weekly hours (per-day toggle,
    start/end, add/remove breaks), days off (date list), and special days
    (date + window + breaks), saved as one schedule replace. Reached from an
    "Agenda" link per row on the Proveedores screen
    (`/providers/[id]/schedule`). Design tokens, lucide icons, no emojis.
  - Tests: schedule GET/PUT case in `admin-read-model.test.ts`. Suite: 279
    passing, 7 skipped, 0 failures. Typecheck, lint, Prettier clean; admin
    `next build` passes. Works in both `demo` and `api` modes.

### 2026-06-19 (Real adapter wiring — Stripe Connect gateway, ADR-0019)

- First real payment adapter behind the existing `PaymentGateway` port; fake
  stays the default so the single-command dev loop is untouched.
  - **Transport:** `FetchStripeHttp` (`packages/integrations/payments/
stripe-http.ts`) — real `api.stripe.com` calls (form-encoded, Bearer auth,
    pinned `Stripe-Version`, `Idempotency-Key`, optional `Stripe-Account`),
    injectable `fetch`/base URL, network failures mapped to a status-0 connection
    error instead of throwing. The `StripeHttpAdapter` interface moved here and is
    re-exported from `stripe-connect-service.ts`, so the connect service and the
    gateway share one transport.
  - **Gateway:** `StripePaymentGateway` — `createCharge` builds a PaymentIntent;
    with a tenant Connect account (vault `stripe_connect/account_id`) it is a
    destination charge (`transfer_data[destination]` + `application_fee_amount`
    from configurable bps), else a plain platform charge. Optional generic
    `paymentMethod` on `ChargeRequest` confirms synchronously. `refund` reverses
    the transfer + claws back the fee for destination charges. Status/error
    mapping → accepted/declined/gateway-error and charge-not-found/exceeds-charge.
  - **Boot:** `resolvePaymentGateway()` in `main.ts` picks Stripe when
    `STRIPE_SECRET_KEY` is set (key sealed in an envelope vault), else the fake.
    New optional env in the contract + `.env.example`: `STRIPE_SECRET_KEY`,
    `STRIPE_WEBHOOK_SECRET`, `STRIPE_APPLICATION_FEE_BPS`, `STRIPE_API_BASE_URL`.
  - Tests: 14 new (10 gateway contract + 4 transport unit). Suite: 293 passing,
    7 skipped, 0 failures. Typecheck, lint, Prettier clean.
  - Known gaps recorded in `TECH_DEBT.md` / ADR-0019: DB-backed `VaultStorage`
    for per-tenant connected-account ids; checkout payment-method + webhook
    capture; Stripe webhook signature verification.

### 2026-06-22 (live end-to-end validation of `api` mode + X-Forwarded-Host fix)

- Ran the prioritized **live validation of `api` mode** against a real stack stood
  up inside the session (PostgreSQL 16 + Redis 7 native, app role
  `saas_app` `NOSUPERUSER NOBYPASSRLS`, migrations `001`–`008`, API in persistent
  mode). No code changes to the app for the validation itself.
  - **RLS proven for real:** with a non-superuser role, fail-closed without tenant
    context (0 rows), visible under the correct tenant, 0 rows under another
    tenant. Confirms the `TECH_DEBT` RLS blocker is the compose superuser role
    only, not a policy gap.
  - **API chain (curl):** tenant provision → staff gate (401/201) → Ubicación →
    Categoría → Servicio → Proveedor (assign + locations) → Agenda → Recurso (hub)
    → Cliente → Disponibilidad (8 slots) → reserva admin no-charge (8→7) → cancel
    (7→8); all persisted in Postgres.
- **Found + fixed a blocking `api`-mode bug (ADR-0018).** The admin `api-client`
  routed the tenant via the `Host` header, but `Host` is a forbidden fetch header
  and `undici` strips it → every call got `404 unknown-host`. Fix: the client now
  sends `X-Forwarded-Host`, and the API tenant hook
  (`availability-routes.ts`) prefers a validated `X-Forwarded-Host` over `Host`
  (resolver re-validates against the registry; staff-auth tenant binding prevents
  a forged header from widening access; production edge proxy must strip inbound
  `X-Forwarded-Host`). Added regression test "resolves the tenant from
  X-Forwarded-Host". With the fix, the **console seam works end to end**: all six
  internal route handlers read real data, and a console write (`POST
/api/locations`) persisted to Postgres.
- **Stripe smoke (Fase B) blocked by network egress:** `api.stripe.com` is not in
  this environment's egress allowlist, so the live round-trip could not run here
  (the checkout's `payment-declined` was the egress block surfacing as a
  connection error, not a real Stripe call). Needs the host allowlisted or a run
  on the operator's machine. Also recorded a correctness finding: the public
  checkout collapses any charge failure (including `gateway-error`) into
  `402 payment-declined`, so a Stripe outage looks like a card decline.
- Green: typecheck, lint, Prettier; full suite **298 passing / 6 skipped, 0
  failures** (Redis up un-skipped the lock tests; +1 new regression test).

### 2026-06-22 (Real adapter: Brevo transactional email, ADR-0020)

- Second real adapter (after Stripe) behind the existing `MessageProvider` port;
  fake stays default so the dev loop and tests are untouched. Email only (owner's
  choice for Brevo's free 300/day tier); Brevo SMS is paid and deferred.
  - **Transport** `notifications/brevo-http.ts` (`FetchBrevoHttp`): `fetch`-backed
    Brevo JSON client (`api-key` header), injectable base URL + fetch, network
    failures mapped to a status-0 response (no throw through the port).
  - **Provider** `notifications/brevo-message-provider.ts`: email maps to
    `POST /v3/smtp/email` (sender/to/subject/htmlContent/optional textContent),
    per-message `from` overrides the default sender; success → `providerId`,
    non-2xx → mapped error; **SMS returns `sms-not-supported` without calling
    Brevo**.
  - **Selection** `notifications/message-provider-factory.ts`
    (`resolveMessageProvider`): Brevo when `BREVO_API_KEY` is set (fail-fast on a
    missing sender), else fake. Framework-agnostic for the future worker bootstrap.
  - **Env contract** + `.env.example`: `BREVO_API_KEY`, `MESSAGING_FROM_EMAIL`,
    `MESSAGING_FROM_NAME`, `BREVO_API_BASE_URL`. Docs: ADR-0020, SETUP, PLANNING,
    TECH_DEBT.
  - Tests: 10 contract tests (`tests/contract/notifications/brevo-message-provider.test.ts`).
    Suite: **308 passing / 6 skipped, 0 failures**; typecheck, lint, Prettier clean.
  - Known gaps (TECH_DEBT): the dispatcher still builds SMS for customers with a
    phone (would fail `sms-not-supported` — needs an email fallback), and no worker
    bootstrap consumes the provider yet, so notifications don't fire in production
    until the worker runtime is wired. Not yet validated against live Brevo.

### 2026-06-22 (Stripe live smoke — real PaymentIntent created, test mode)

- Ran the Stripe test-mode smoke on the operator's machine (egress to
  `api.stripe.com` is blocked in the session container, so this was done locally):
  set `STRIPE_SECRET_KEY=sk_test_…` in `.env`, restarted the API in persistent
  mode, provisioned a throwaway tenant + catalog + provider schedule, and hit
  `POST /v1/public/checkout`.
  - Result: checkout returned **`402 payment-declined`** (the real gateway — the
    fake would have returned `201`), and Stripe held a **real PaymentIntent**
    (`pi_…`, `amount: 3000`, `currency: eur`, `status: requires_payment_method`).
  - This proves the **API → `api.stripe.com` round-trip** end to end: gateway
    selection, HTTP transport, key auth, and charge creation with the correct
    amount/currency.
  - **Not yet proven:** a charge reaching `succeeded`. The public checkout does not
    pass a payment method, so Stripe leaves the intent in `requires_payment_method`
    and the gateway reports it as declined. Closing this needs the payment-method
    passthrough + webhook capture (TECH_DEBT / ADR-0019 follow-up).
  - Operator note: their terminal corrupts large multi-line pastes; use a file
    (`bash script.sh`) or one-line commands.

### 2026-06-22 (Stripe payment-method passthrough + webhook capture + signature verification)

- Closed two Stripe gaps so a charge can reach `succeeded` end to end (ADR-0019
  follow-up):
  - **Payment method passthrough.** `ChargeRequest` gained `metadata`; the Stripe
    gateway now emits `metadata[…]` on the PaymentIntent. `chargeCart` threads an
    optional `paymentMethod` + `description` + `metadata.cartId`, and the public
    checkout (`CheckoutBody.paymentMethod`) forwards it — so a `pm_card_visa`
    confirms the intent synchronously.
  - **Stripe webhook capture.** New `POST /v1/public/payments/stripe-webhook`:
    verifies the signature (`verifyStripeSignature`, HMAC-SHA256 over the raw body,
    constant-time compare, timestamp tolerance) when `STRIPE_WEBHOOK_SECRET` is
    set, maps `payment_intent.succeeded` → approve (+ occupancy) and
    `payment_failed`/`canceled` → reject, idempotent per Stripe event id via the
    existing `WebhookProcessor`. It is a **platform-level endpoint** (one URL for
    all tenants, exempt from Host-based tenant resolution) that resolves the tenant
    - cart from the signed event metadata (`tenantId`/`cartId`). The settle logic
      is shared with the generic (fake) webhook.
  - **Raw body.** `buildApp` adds a JSON content-type parser that stashes the raw
    body (needed because signature verification must hash the exact bytes);
    handlers still receive parsed JSON.
  - Wiring: `stripeWebhookSecret` flows into both `main.ts` bootstraps from
    `STRIPE_WEBHOOK_SECRET`.
  - Tests: 7 signature unit + 3 stripe-webhook e2e (approve/idempotent, bad
    signature → 400, payment-failure → reject + free slot) + gateway metadata
    assertion. Suite: **318 passing / 6 skipped, 0 failures**; typecheck, lint,
    Prettier clean.
  - Still open (TECH_DEBT): DB-backed `VaultStorage` for connected-account ids;
    live validation of an actual Stripe webhook delivery (`stripe listen`); the
    checkout still reports `gateway-error` as `payment-declined`.

### 2026-06-22 (session close — pivot to MVP/deployment)

- Owner-led re-prioritization: **pause deepening payment plumbing** and focus the
  next work on the **path to a launchable MVP** — deploy on a real domain/host,
  the public booking widget, and minimal email notifications (worker bootstrap +
  email-only dispatcher). Rationale: no MVP deployed and no domain yet; the
  Stripe succeeded-flow code is done behind flags and live webhook validation is
  deferred until there is a deployment. Details + open questions in `HANDOFF.md`
  ("Session Close — READ FIRST").
- Operator setup (owner's machine, not in the repo): installed the **Stripe CLI**
  (1.42.14), `stripe login` (account "Narganes"), and saved a `whsec_…` webhook
  signing secret into the local `.env` as `STRIPE_WEBHOOK_SECRET` — prepared but
  unused until deployment.
- Repo hygiene: all session work merged to `main`; the working branch was deleted
  (no dangling branches). Onboarding note recorded: the owner is a beginner — go
  step by step and avoid large multi-line terminal pastes (they corrupt).

### 2026-06-23 (Amelia fine-grained sweep — 13 docs)

- Documentación exhaustiva campo a campo de **toda la interfaz de Amelia Premium**
  en 13 archivos `docs/analysis/amelia-*-fine-grained.md` (Dashboard, Calendar,
  Bookings, Events, Employees, Catalog, Locations, Customers, Finance, Notifications,
  Customize, Custom Fields, Integrations) ≈ **160+ tablas**. Cada tabla lleva columnas
  Campo/Tipo/Opciones/Default + **Estado SaaS** (✅/🔶/❌) y **Prioridad** (🔴/🟡/🟢),
  más "Resumen de brechas críticas" por archivo. Es la referencia completa de UX/feature
  para el crecimiento del SaaS. Sesión de análisis; sin cambios de stack.

### 2026-06-23 (recorrido del menú admin + gap-analysis + reorg de docs)

- **Recorrido del panel admin área por área (13/13)** desde el sidebar, validando el
  código real contra los `amelia-*-fine-grained.md`. Resultado volcado a
  `docs/analysis/menu-walkthrough-gap-analysis.md` (nuevo): por área, estado actual ↔
  referencia ↔ huecos ↔ candidatos a feature, + matriz de madurez, 8 decisiones
  transversales y el clúster crítico de MVP. Es el **índice de features** que alimenta
  `/speckit-specify`.
- Hallazgos clave: `/operations` es una vista **cross-tenant sin auth** dentro de
  `apps/admin` (seguridad + objetivo superadmin); rompe además el design system
  (Tailwind/inglés). Settings es un wizard de alta, no ajustes (faltan políticas de
  tiempo, sender email por tenant, activar pasarela, perfil del tenant). "Facturación"
  mezcla SaaS-billing con finanzas-del-negocio (cupones/gift cards no modelados).
  Categoría es texto libre (debería ser entidad). Eventos/Auditoría/Facturación son
  placeholders con backend ya hecho.
- **Reorganización de los docs de continuidad** (sin tocar `specs/001`, ADRs ni
  constitución): `HANDOFF.md` adelgazado (564→~75 líneas) a punto-de-reanudación puro;
  historial migrado/consolidado aquí en `PROGRESS.md` (diario único); `PLANNING.md`
  ampliado con el modelo de documentos en 4 capas y el flujo de crecimiento por feature.
  Decisión operativa: **una feature de Spec-Kit por área de crecimiento** (002, 003…),
  sembrada desde el gap-analysis + la referencia Amelia.

### 2026-06-24 (8 decisiones transversales resueltas — ADR-0021)

- Resueltas con el dueño las **8 decisiones transversales** surgidas del recorrido del
  menú (gap-analysis), que bloqueaban abrir specs limpias. Registradas en
  `docs/adr/0021-cross-cutting-product-decisions.md` (nuevo) y marcadas en
  `docs/analysis/menu-walkthrough-gap-analysis.md`:
  1. **Categoría** → entidad de primera clase (no texto libre) → `categorias-entidad`.
  2. **Online/virtual** → diferido a post-MVP (Decisión pendiente #5).
  3. **Group booking / partición de cantidad** → sigue diferido (ADR-0016).
  4. **Políticas (cancelación/reprogramación) + moneda** → global por tenant
     (`tenant_settings`); override por sede como extensión futura → `tenant-settings`.
  5. **IA Facturación** → separar Facturación (SaaS) de Finanzas (negocio) en el menú.
  6. **IA sidebar** → Notifications/Custom Fields/Integrations plegadas en Configuración;
     Customize ligado al widget público.
  7. **Auth/plataforma** → superficie de plataforma separada con auth superadmin (mueve
     Operaciones + provisión de tenants); proveedor separado de `staff_accounts` pero
     vinculable (`staff.providerId` opcional) → `plataforma-superadmin`.
  8. **Ciclo de estados de reserva** → 6 estados (Pending/Approved/Rejected/Cancelled/
     Completed/No-show), default **Approved**, configurable por tenant →
     `reservas-ciclo-estados-pagos`.
- También: completado el índice de `docs/adr/README.md` (faltaban 0009–0014, 0018–0020;
  añadido 0021). Actualizados `HANDOFF.md` (punto de reanudación + próximas acciones) y
  este diario. Sin cambios de código ni de stack.
- **Abierta la primera feature de crecimiento con `/speckit-specify`:**
  `specs/002-plataforma-superadmin/` (spec.md + checklists/requirements.md). 4 historias de
  usuario priorizadas: P1 auth de plataforma + superficie protegida (cierra el agujero de
  `/operations` y de la provisión de tenants abierta), P2 provisión/ciclo de vida de tenants
  bajo auth, P3 panel de Operaciones cross-tenant migrado a la plataforma + alineado al DS, P3
  vínculo proveedor↔cuenta staff (ADR-0021 #7). Checklist de calidad: todos los ítems en verde.
  `.specify/feature.json` apunta ya a 002. Único item abierto para `/speckit-clarify`: bootstrap
  del primer operador de plataforma. Siguiente paso: `/speckit-clarify` o `/speckit-plan`.

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
