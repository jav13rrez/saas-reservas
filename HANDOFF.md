# Handoff

Last updated: 2026-06-22

## Post-Spec Work (2026-06-22): Live `api`-mode validation + X-Forwarded-Host fix

The prioritized **live end-to-end validation of `api` mode** is **done**. A real
stack (PostgreSQL 16 + Redis 7 + persistent API) was stood up inside the session
with an app role that is `NOSUPERUSER NOBYPASSRLS`, and the full admin chain was
exercised both via the API (curl) and via the console (`apps/admin` in
`ADMIN_DATA_MODE=api`):

- **RLS proven** with a non-superuser role: fail-closed without tenant context,
  isolation across tenants. Confirms the RLS blocker is the compose superuser role
  only (no policy gap).
- **Chain validated end to end:** Ubicación → Categoría → Servicio → Proveedor
  (assign + locations) → Agenda → Recurso (hub) → Cliente → Disponibilidad (8
  slots) → reserva admin no-charge (8→7) → cancel (7→8); persisted in Postgres.
- **Blocking bug found + fixed (ADR-0018):** the admin `api-client` routed the
  tenant via the `Host` header, which `undici` strips (forbidden fetch header) →
  `404 unknown-host`. Now it sends `X-Forwarded-Host`; the API tenant hook prefers
  a validated `X-Forwarded-Host` over `Host`. Regression test added. The console
  seam now works end to end (reads + a write that persisted to Postgres). Green:
  typecheck, lint, Prettier, full suite 298 passing / 6 skipped.

**Next actions (priority order):**

1. **Stripe test-mode smoke is still pending** — blocked here by network egress
   (`api.stripe.com` not in the session allowlist). Run it after allowlisting the
   host, or on the operator's machine: `STRIPE_SECRET_KEY=sk_test_…` through the
   public checkout. Also fix the checkout correctness finding (it reports
   `gateway-error` as `payment-declined`) — see `TECH_DEBT.md`.
2. **Remaining real adapters:** SendGrid/Twilio (messaging), AWS KMS (real
   `KmsAdapter`), S3 (attachments). See `PLANNING.md` Immediate Route #4.
3. **Stripe follow-ups (TECH_DEBT):** DB-backed `VaultStorage` for connected-account
   ids; payment-method + webhook-capture in the public checkout; webhook signature
   verification.

### How to re-stand the local stack in a fresh session (no Docker needed)

Postgres 16 server binaries live at `/usr/lib/postgresql/16/bin`; `redis-server`
is on PATH. Run Postgres as a non-root user with a `NOSUPERUSER NOBYPASSRLS`
`saas_app` role owning the DB (so RLS is genuinely enforced), apply migrations
`001`–`008` as that role, start Redis, then boot the API with `node
--env-file=.env services/api/dist/main.js`. The admin runs with
`ADMIN_DATA_MODE=api API_ORIGIN=http://127.0.0.1:3001
ADMIN_TENANT_HOST=<slug>.reservas.localhost` + staff creds. Note: `api.stripe.com`
egress is blocked in-session.



## Post-Spec Work (2026-06-19): Real Stripe Connect gateway — WIRED (ADR-0019)

The first real payment adapter is in place behind the existing `PaymentGateway`
port. `StripePaymentGateway` (`packages/integrations/payments/stripe-gateway.ts`)
does destination charges with an application fee when a tenant has an onboarded
Connect account, and a plain platform charge otherwise; refunds reverse the
transfer and claw back the fee. A real transport (`FetchStripeHttp`, shared with
`StripeConnectService`) talks to `api.stripe.com` with idempotency keys; `fetch`
and base URL are injectable. `main.ts` selects it via `resolvePaymentGateway()`
when `STRIPE_SECRET_KEY` is set, else keeps the deterministic fake (dev loop
untouched). New optional env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_APPLICATION_FEE_BPS`, `STRIPE_API_BASE_URL`. Full decision + known gaps in
**ADR-0019**. Green: typecheck, lint, Prettier, 293 tests (14 new payment tests).

**Next actions (priority order):**

1. **Live end-to-end validation of `api` mode** against the running stack
   (Postgres + Redis + API) — the one thing not exercisable in this container.
   Covers objective-2 tail and objective-3 (per-provider agenda), plus a Stripe
   **test-mode** smoke (set `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_API_BASE_URL`
   optional) through checkout.
2. **Remaining real adapters:** SendGrid/Twilio (messaging), AWS KMS (real
   `KmsAdapter` for the vault), S3 (attachments). See `PLANNING.md` Immediate
   Route #4.
3. **Stripe follow-ups (TECH_DEBT, from ADR-0019):** DB-backed `VaultStorage` so
   per-tenant connected-account ids resolve in production; pass a payment method
   through the public checkout (client-confirm + webhook-capture); enforce Stripe
   webhook signature verification with `STRIPE_WEBHOOK_SECRET`.

## Post-Spec Work (2026-06-19): Admin ↔ persistent API — COMPLETE (ADR-0018)

Objective 2 (connect `apps/admin` to the persistent Fastify API) is functionally
**complete**. In `api` mode (`ADMIN_DATA_MODE=api`) the console drives the real
PostgreSQL/RLS stack for Locations, Customers, Servicios, Proveedores, Recursos,
Reservas, and Calendario; `demo` stays the default so the single-command dev loop
is untouched. Full architecture + decisions in **ADR-0018**.

Built across the session (all committed locally, no push):

- **Read surface + Locations:** `GET /v1/admin/{categories,services,providers,
resources}` and Locations CRUD.
- **Customer registry:** `GET/POST /v1/admin/customers`.
- **Catalog writes:** `PATCH` service/provider/resource + `DELETE` service↔provider
  unassign; the seam wires create/update/toggle for all catalog screens.
- **Admin bookings (no-charge, decided):** `AdminBookingService` +
  `GET/POST /v1/admin/bookings` + cancel, reusing the availability engine and
  occupancy recorder; Reservas + Calendario wired.

**Decisions taken (owner):** admin booking is no-charge "book on behalf"; finish
objective-2 tail before objective 3.

**Remaining for objective 2 (small / deferred):**

- Live end-to-end validation in `api` mode against the running stack (needs
  Postgres+Redis+API; not exercisable in this container).
- Customer active-toggle in `api` mode (no domain concept yet) and wiring checkout
  to the customer registry (TECH_DEBT).

## Post-Spec Work (2026-06-19): Objective 3 — per-provider scheduling (DONE)

The per-provider agenda (Work hours / Days off / Special days), the known gap vs.
Amelia, is implemented end to end and works in both `demo` and `api` modes:

- API `GET /v1/admin/providers/:id/schedule` (PUT already existed);
  `CatalogService.listProviderSchedule`.
- Admin demo store gained a validated schedule map; new `source/schedules.ts`
  seam and `app/api/providers/[id]/schedule` route handler.
- New editor `features/provider-schedule` (weekly hours with breaks, days off,
  special days), reached from an "Agenda" link per provider row
  (`/providers/[id]/schedule`).

**Both prioritized objectives (2 and 3) are complete.** Suggested next work:

- Live end-to-end validation of `api` mode against the running stack
  (Postgres+Redis+API) — the one thing not exercisable in this container.
- Remaining deferred items in `TECH_DEBT.md` (customer active-toggle in api mode,
  checkout→customer-registry wiring, admin-booking slot lock) and the real
  adapters (Stripe Connect first, per `PLANNING.md` Immediate Route).

### Earlier 2026-06-19 detail: Phase 1 (read surface + Locations)

Phase 1 (backend foundation + Locations vertical); the console default stays
`demo` so the single-command dev loop is untouched.

- **API read surface:** `GET /v1/admin/{categories,services,providers,resources}`
  (providers enriched with service assignments + locations; resources with hub
  associations). New `CatalogRepository.list*` methods on both adapters.
- **Locations CRUD (canonical):** `LocationService` + `LocationRepository`,
  routes `GET/POST/PATCH /v1/admin/locations`, in-memory + Drizzle adapters,
  wired in `main.ts`. Shared-contract + e2e tests (269 passing, 6 skipped).
- **Admin client seam:** `ADMIN_DATA_MODE` env (`demo`|`api`), server-only
  `api-client.ts` (Host header + cached staff login, re-auth on 401), and the
  **Locations** route handlers delegated through `src/server/source/locations.ts`.
  New env vars in `.env.example`: `ADMIN_DATA_MODE`, `API_ORIGIN`,
  `ADMIN_TENANT_HOST`, `ADMIN_STAFF_EMAIL`, `ADMIN_STAFF_PASSWORD`.

Phase 2 (customer registry) is also done: `CustomerService` +
`GET/POST /v1/admin/customers` over the `customers` table, and the Clientes
screen reads/creates through the seam in `api` mode (active toggle unsupported
there — no domain concept). Pays down the "no real customer registry" debt.

**Next actions (ADR-0018 Phases 3–5):**

1. **Admin bookings** — staff "book on behalf" flow (`/v1/admin/bookings`
   list/create/cancel) reusing the availability engine + occupancy recorder
   without the public payment path; unblocks Reservas + Calendario in `api` mode.
   NOTE: this carries a product decision (does an admin booking take payment, or
   is it a no-charge staff booking?) — confirm before building.
2. **Catalog DTO mapping** — DONE for Locations, Customers, and Services (list +
   create through the `source/` seam; Services resolves `category`→`categoryId`).
   Remaining: Providers and Resources, which need new API write routes (provider
   update + service-unassign; resource name/quantity update) to wire without
   partial-edit gaps — pair this with Phase 5 (writes/toggles). Service/customer
   active toggles also wait on Phase 5 update routes.
3. **Live validation** — run the console in `api` mode against the running stack
   (Postgres+Redis+API) end to end; not exercisable in this dev container.

Objective 3 (per-provider scheduling: Work hours / Days off / Special days) is
the next prioritized milestone after objective 2. The API already has
`PUT /v1/admin/providers/:id/schedule` (weekly/day-off/special entries); the gap
is the admin UI + exposing it through the seam.

## Resume Point For The Next Session (operator onboarding)

The repo owner comes from a Supabase + Vercel background and is onboarding by
running the project locally for the first time. Status of the walkthrough:

- ✅ **Part 1 done:** the admin console (`apps/admin`) runs on their machine
  (`pnpm --filter @saas-reservas/admin dev`, Node 22 via nvm) — in-memory demo
  data, no DB. Panel at `http://localhost:3000`.
- ✅ **Part 2 done (2026-06-18):** full local stack is up and validated end to
  end. Docker Engine runs **natively inside WSL2** (Ubuntu, no Docker Desktop,
  systemd on). `postgres` + `redis` healthy via `infra/docker-compose.yml`
  (migrations `001`…`008` auto-applied on first boot). `.env` built from
  `.env.example` with generated secrets; API runs in **persistent mode**
  (`node --env-file=.env services/api/dist/main.js`). Verified the full chain on
  a real tenant: provision (`/v1/platform/tenants` → `mi-negocio`) → bootstrap
  admin + staff login (cookie) → catalog (category/service/provider/schedule) →
  `/v1/public/availability` (8 slots) → **checkout + payment webhook** (booking
  pending → approved, slot removed from availability). See PROGRESS 2026-06-18.
- ⏭️ **Next options:** (a) connect `apps/admin` to the persistent API (today it
  uses its in-memory demo-store); (b) start the real adapters (Stripe Connect
  first); (c) per-provider scheduling depth. Plus the pre-VPS debts in
  `TECH_DEBT.md`. The owner prefers detailed, step-by-step Spanish.

Mental model to keep reinforcing: this is NOT a Supabase/Vercel stack — it is a
self-hosted Fastify API + raw PostgreSQL (RLS) + Redis. When deploying later:
Supabase = hosted Postgres only (custom non-superuser role, run the SQL
migrations; not Supabase Auth), Upstash = Redis, Railway/Render = the API (not
Vercel), Vercel = the Next.js apps (`apps/admin`, `apps/booking-widget`).
Note (TECH_DEBT.md): the local Docker `saas_admin` role is a superuser and
**bypasses RLS** — production must use a `NOSUPERUSER NOBYPASSRLS` app role.

## Post-Spec Work (2026-06-17f): Operator setup docs + relaxed env contract

- **`.env.example`** and **`docs/operations/SETUP.md`** added: full operator
  checklist (infra, secrets, env vars, external provider accounts, global vs
  per-tenant, wiring status).
- **`environment.ts` relaxed:** persistent mode now boots with just
  `DATABASE_URL`, `REDIS_URL`, `PLATFORM_BASE_DOMAIN`, `PASSWORDLESS_TOKEN_SECRET`,
  `SESSION_COOKIE_SECRET`. `STORAGE_*` and `CREDENTIALS_MASTER_KEY` are now
  optional until their features are wired (still validated when present, so a
  misconfigured value fails fast). Verified a minimal env validates.

## Post-Spec Work (2026-06-17e): Production server bootstrap

`services/api/src/main.ts` is now a mode-selectable composition root:

- **Persistent mode** (when `DATABASE_URL` is set): validates the full
  environment via `loadEnvironment` (`@saas-reservas/contracts/environment`,
  fail-fast) and wires the Drizzle/RLS adapters (`DrizzleTenantRepository`,
  `DrizzleCatalogRepository`, `DrizzleResourceHubRepository`,
  `DrizzleStaffAccountRepository`, `DrizzlePaymentRepository`, `DrizzleEventSink`,
  `DrizzleProcessedWebhookStore`, `DrizzleHoldStore`) plus a Redis-backed
  `RedisLockStore` for checkout locks. Listens on `API_HOST:API_PORT`.
- **In-memory mode** (no `DATABASE_URL`): the previous dev behavior — in-memory
  adapters, seeds the first demo tenant, port 3001.
- `services/api` now depends on `@saas-reservas/persistence` (added to
  `package.json` + `tsconfig.json` references). SIGTERM/SIGINT close the app, the
  DB pool, and Redis. The `/v1/ops/*` routes are now exempt from tenant
  resolution (platform-level), so the ops dashboard feed is reachable.
- Smoke-tested: dev boot serves `/v1/ops/tenants`; the persistent path typechecks
  and mirrors the proven `drizzle-checkout.test.ts` composition.

**Payment gateway is still the fake adapter in both modes** — swapping it for
Stripe Connect (and the other real adapters) is the next follow-up; it sits
behind the existing `PaymentGateway` port. Migrations are applied operationally
(the SQL files in `infra/postgres/`), not at boot.

## Post-Spec Work (2026-06-17d): Staff authentication for /v1/admin/\*

`/v1/admin/*` now has real staff auth (ADR-0005, implementation in ADR-0017),
replacing the `SYSTEM_ACTOR` placeholder.

- **Model:** tenant-scoped `staff_accounts` (email + scrypt password hash, role
  `admin`/`staff`, RLS) — `008-staff-accounts.sql`, `staffAccounts` in
  `schema.ts`, `StaffAccountStore` port with in-memory + Drizzle adapters.
- **Service:** `StaffAuthService` (`application/identity/staff-auth-service.ts`)
  — `createAccount` (hashes via `application/identity/password.ts` scrypt),
  `authenticate` → opaque `staff_session` cookie (HttpOnly/Secure/SameSite, 8h),
  `getSession` (tenant-bound, TTL), `logout`. Sessions in-memory (like the
  customer passwordless service).
- **Gate:** `buildApp` takes an **optional** `staffAuth`. When provided,
  `/v1/admin/*` requires an admin session (401/403) and the audit actor becomes
  the staff member; when omitted, routes stay open (existing fast tests unchanged).
  `main.ts` wires it.
- **Routes:** `POST/DELETE /v1/admin/sessions` (login/logout, public),
  `POST /v1/admin/staff` (admin adds staff), `POST /v1/platform/tenants/:id/staff`
  (bootstrap first admin).
- Tests: `tests/unit/identity/password.test.ts`, `tests/e2e/staff-auth.test.ts`.
  Suite: 261 passing, 5 skipped, 0 failures. Typecheck/lint clean.

**Scrypt vs argon2 (ADR-0017):** scrypt is used (no native build for argon2 in
this env). **Follow-ups:** persistent/shared session store (in-memory map is
per-process), login rate limiting, optional argon2id, staff portal still uses the
dev-only `x-provider-id` header (not migrated to staff sessions yet).

## Post-Spec Work (2026-06-17): Canonical resource-hub migration (additive)

The ADR-0016 resource hub now exists in the **canonical domain/persistence layer**,
not just the admin demo store. This was done **additively and non-destructively** —
the legacy ADR-0015 model B is retained and still drives availability; nothing was
dropped.

- Domain helpers: `packages/domain/src/catalog/resource-hub.ts`
  (`resourceServesService`, `resourceAllowsProvider`,
  `resourceCompatibleWithLocations`, `hubResourcesForBooking`), same empty-array
  "any" semantics as the admin store.
- SQL: `infra/postgres/004-resource-hub.sql` adds `resource_services`,
  `resource_locations`, `resource_employees` (RLS, idempotent), mirrored in
  `packages/persistence/src/schema.ts`. The `resources.location_id`,
  `service_resources` and `provider_resources` tables are **kept**.
- Port + service: `ResourceHubRepository` and audited `ResourceHubService` in
  `services/api/src/application/catalog/resource-hub-service.ts`, implemented by
  `InMemoryStore` and the new `DrizzleResourceHubRepository`.
- Tests: `tests/unit/catalog/resource-hub.test.ts` (11) and the shared-contract
  `tests/integration/catalog/resource-hub.test.ts` (in-memory always; Drizzle
  self-skips without PostgreSQL). The integration fixture now applies migrations
  003 + 004.

## Post-Spec Work (2026-06-17b): Hub read-model cutover (availability / checkout / Fastify)

The availability engine, checkout, reschedule, and Fastify admin now read the
hub instead of the legacy model-B tables:

- `AvailabilityService` takes a `ResourceHubRepository`; resource constraints come
  from `listHubResourcesForService`. The serving resources form an interchangeable
  pool collapsed into one synthetic engine demand (`hub-resources.ts`,
  `HUB_POOL_RESOURCE_ID`): quantity = Σ candidate quantities, allocations = union,
  so `unitsInUse + 1 <= total` means "≥1 free unit". No resource serving the
  service → no constraint; resources exist but provider eligible for none → zero
  availability. The availability _engine_ itself is unchanged (the legacy
  `resources`/`providerEligibleResourceIds` fields still exist and are still
  covered by `resource-conflicts.test.ts`).
- `checkout-routes` and `BookingChangeService` (reschedule) allocate one eligible,
  location-compatible pool resource with a free unit (iterating candidates so a
  contended room falls through to a free one), via the new `hub` dep.
- Fastify admin hub routes (optional `resourceHub` dep): `PUT
/v1/admin/resources/:id/{services,locations,employees}` and `GET
/v1/admin/resources/:id/hub`.
- New test: `tests/integration/scheduling/hub-availability.test.ts` proves the
  pool capacity ("2 rooms") and eligibility-zero behavior. Suite: 257 passing,
  5 skipped, 0 failures.

## Post-Spec Work (2026-06-17c): Provider locations + legacy model-B drop

The hub cutover is now complete end to end and the legacy model-B tables are gone:

- **Provider locations (canonical):** `provider_locations` join table
  (`infra/postgres/005-provider-locations.sql`, `providerLocations` in
  `schema.ts`), `CatalogRepository.{setProviderLocations,listProviderLocationIds}`
  on both adapters, `CatalogService.setProviderLocations`, and Fastify `PUT
/v1/admin/providers/:id/locations`. Availability, checkout, and reschedule now
  pass the provider's locations into `hubCandidates`, so hub location
  compatibility is real (empty on either side still means "any").
- **Destructive migration:** `infra/postgres/006-drop-legacy-resource-model.sql`
  drops `provider_resources` and `service_resources`. All their plumbing was
  removed: domain `ServiceResource`/`ProviderResource`/`providerEligibleForResources`,
  the `CatalogRepository` methods `linkResource`/`setProviderResources`/
  `listResourceDemands`/`listProviderEligibleResourceIds` (both adapters), the
  Drizzle table defs, and the `POST /v1/admin/services/:id/resources` route.
- The availability _engine_ is untouched (its generic `resources` /
  `providerEligibleResourceIds` inputs remain, still covered by
  `resource-conflicts.test.ts`).
- Suite: 254 passing, 5 skipped, 0 failures. Typecheck and lint clean.

**Cleanup done (2026-06-17):** `resources.location_id` (ADR-0015 model C single-site
column) was dropped (`007-drop-resource-location-id.sql`) and removed from the
domain `Resource` and the Drizzle schema. Multi-site placement lives entirely in
`resource_locations`. The hub is now the complete and sole resource model with no
legacy remnants.

## Post-Spec Work (2026-06-16): Admin Console + Resource Model B/C

Beyond T001–T086, the admin console (`apps/admin`) gained a sidebar shell with product areas, and **Servicios / Reservas / Recursos / Ubicaciones / Proveedores / Clientes / Calendario** are functional screens backed by process-local Next.js route handlers (`apps/admin/src/server/demo-store.ts`) so the console runs with a single `pnpm dev` (no Fastify needed). The API proxy is narrowed to `/api/v1/*` so it does not shadow these handlers.

The full assignment chain is now wired end to end in the admin demo store: `Ubicación -> Recurso -> Proveedor -> Servicio -> Reserva -> Cliente`. Customers (`AdminCustomer`) are first-class (Clientes screen) and bookings link a `customerId` + `providerId`. The Calendario screen renders a weekly grid of confirmed bookings grouped by provider. (This is admin-demo-store wiring; the Fastify `/v1/admin/*` provider/customer/eligibility routes remain the productionization step.)

**Resource hub model (2026-06-16, ADR-0016).** After a full Amelia admin sweep (`docs/analysis/amelia-ux-reference.md`), the admin resource model was migrated to a _hub_: `AdminResource` now declares `locationIds[]`, `serviceIds[]` and `employeeIds[]` (empty = "any"). `AdminService` lost `resourceId`/`resourceUnits` and `AdminProvider` lost `resourceIds` — eligibility now lives only on the resource (single source of truth). The **Recursos** screen is the hub config page (three checkbox groups + edit/save); Proveedores and Servicios dropped their resource controls. `createBooking` allocates: for the booked service it finds active resources whose `serviceIds` include it, filters by provider eligibility and location compatibility, then requires at least one with a free unit (capacity stays 1 unit/booking). Deferred on purpose: quantity partition (`shared/per-service/per-location`) and group booking. **Scope:** this lands only in `apps/admin/src/server/demo-store.ts` + its route handlers; the canonical domain/persistence layer (ADR-0015) still carries the old shape and needs a follow-up migration (join tables `resource_services`/`resource_locations`/`resource_employees`, drop `provider_resources` + `service.resource_id`).

The resource model was extended to **model B (provider-resource eligibility) + model C (multi-site locations)** per ADR-0015:

- Domain: `Location` (`packages/domain/src/locations/location.ts`), `Resource.locationId`, `ProviderResource` + `providerEligibleForResources()`.
- Engine: `computeAvailableSlots` honors `providerEligibleResourceIds` (zero availability when a provider is not eligible for a demanded resource).
- Persistence: `locations` + `provider_resources` tables, `resources.location_id`, migration `infra/postgres/003-locations-eligibility.sql`; in-memory + Drizzle adapters.
- Admin UI enforces concurrent resource capacity in bookings (the "4 therapists / 2 rooms" constraint is observable). See `docs/analysis/resources-model-review.md`.

Remaining for full B/C: Fastify `/v1/admin/*` routes for locations/eligibility, provider-portal eligibility editor, public-widget exposure, and resource _groups_ (interchangeable pools with per-provider subsets). See ADR-0015 "Consequences". Note the eligibility _direction_ changed with the hub migration (ADR-0016): the domain `ProviderResource` association should be replaced by resource-owned `employeeIds` when the canonical layer is migrated.

## Technical Debt Ledger

`TECH_DEBT.md` (repo root) is the cumulative register of dev-only shortcuts and
not-yet-production-ready choices to resolve before a real VPS launch. Add an
entry whenever you introduce or discover a debt; mark blockers vs. lower
severity. Read it before planning a production deployment.

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

5. **Fix pre-existing flaky test**: DONE (2026-06-17). `customer-passwordless.test.ts` "expires sessions after their TTL" was failing because `InMemoryNonceStore.consume` checked nonce expiry against the wall clock (`Date.now()`) while the service threads an injected `now` everywhere else. `NonceStore.consume` now takes an optional `nowMs` and `redeem` passes its `now`, so behavior is clock-consistent and deterministic.

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
