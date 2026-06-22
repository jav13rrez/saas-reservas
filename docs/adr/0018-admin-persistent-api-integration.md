# ADR-0018: Admin Console ↔ Persistent API Integration

**Date**: 2026-06-19 (updated 2026-06-22)
**Status**: accepted (Phases 1–5 implemented; live `api`-mode validation **done** 2026-06-22)
**Deciders**: Project owner + agent
**Relates to**: ADR-0002 (Fastify API), ADR-0016 (resource hub), ADR-0017 (staff auth)

## Context

The admin console (`apps/admin`) runs today entirely on a **process-local
in-memory demo store** (`src/server/demo-store.ts`) behind Next.js route
handlers (`app/api/*`). This keeps the console runnable with a single
`pnpm --filter @saas-reservas/admin dev` and no backend, which is great for UI
work and demos, but it is **not** the real product: data is lost on restart,
there is no tenant isolation, no staff auth, and nothing the operator does in
the console reaches the persistent Fastify API + PostgreSQL/RLS stack that
`main.ts` boots in persistent mode.

The owner has validated the full booking chain by hand against the persistent
API (tenant provisioning → staff login → catalog → availability → checkout →
payment webhook). The next milestone is to let the **admin console drive that
same persistent stack** instead of its demo store.

### The gap

When this work started, `/v1/admin/*` was almost entirely **write-only**
(create category/service/provider/resource, assign provider, set
schedule/locations, configure the resource hub). It had:

- no **list/read** endpoints, so the console could not render from the API;
- no **locations** CRUD (the `locations` table existed but had no service/routes);
- no **customer registry** (checkout mints `customerId: randomUUID()` per booking);
- no **admin-side booking** create/list/cancel (bookings only exist via the
  public checkout + payment flow).

There is also a **shape impedance** between the two models:

| Concept  | Admin demo store                                      | Persistent API / domain                                                   |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Service  | `category` free string, `active: boolean`             | `categoryId` (Category entity), `status`, capacity/buffers fields         |
| Provider | `name`, `serviceIds[]`, `locationIds[]` inline        | `displayName`, assignments via `service_providers` + `provider_locations` |
| Resource | hub (`serviceIds`/`locationIds`/`employeeIds`) inline | `resources` row + 3 hub join tables, set via separate PUTs                |
| Active   | `active: boolean`                                     | `status: "active" \| "inactive"`                                          |

## Decision

Integrate the console with the persistent API **incrementally**, keeping the
demo store as the default so the single-command dev experience never breaks.

1. **Mode switch, mirroring `main.ts`.** The admin gains an `ADMIN_DATA_MODE`
   environment variable: `demo` (default — in-memory store, today's behavior) or
   `api` (talk to the persistent Fastify API). The Next.js route handlers
   delegate to a `DataSource` abstraction chosen at request time; the React
   feature screens are unchanged (they keep calling `/api/*`).

2. **Server-side API client owns auth and tenancy.** In `api` mode a server-only
   client (`apps/admin/src/server/api-client.ts`) calls the Fastify API with the
   tenant routing header (`ADMIN_TENANT_HOST`) and a cached **staff session
   cookie** obtained by logging in with configured staff credentials
   (`ADMIN_STAFF_EMAIL` / `ADMIN_STAFF_PASSWORD`), re-authenticating on 401. The
   browser never sees API origins or staff credentials. (A real per-operator
   login UI replacing the service-account credentials is a later step.)

   **Tenant routing uses `X-Forwarded-Host`, not `Host` (corrected 2026-06-22).**
   The original design sent the tenant host in the `Host` header. This silently
   failed in `api` mode: `Host` is a [forbidden header](https://fetch.spec.whatwg.org/#forbidden-header-name)
   in the fetch spec and Node's `undici` strips it, so every API call routed to
   the API's own host and got `404 unknown-host`. The fix: the client sends
   `X-Forwarded-Host`, and the API tenant hook (`availability-routes.ts`) prefers
   a validated `X-Forwarded-Host` over `Host`. The resolver re-validates the value
   against the tenant registry on every request and the staff-auth gate binds
   sessions to the host-resolved tenant, so a forged header cannot widen access.
   SECURITY: a production edge proxy MUST strip any inbound `X-Forwarded-Host` and
   set its own before this hop.

3. **The API client maps shapes and orchestrates multi-call writes.** The
   demo-store DTOs remain the console's contract; the `api` `DataSource`
   translates to/from the domain shape (`category`↔`categoryId`,
   `active`↔`status`, `name`↔`displayName`) and fans a single console "create
   resource with hub" into the resource create + three hub PUTs, etc.

4. **Build out the missing API surface as needed, canonically.** Read endpoints
   and the absent entities are added to the Fastify API (domain + both adapters +
   RLS + tests), never faked in the admin.

## Staged plan

- **Phase 1 — API read surface + Locations (this change).** Added
  `GET /v1/admin/{categories,services,providers,resources}` (providers enriched
  with their service assignments + work locations; resources enriched with hub
  associations) and full **Locations** CRUD
  (`GET/POST/PATCH /v1/admin/locations`) via a new `LocationService` +
  `LocationRepository` with in-memory and Drizzle/RLS adapters. Covered by an
  e2e read-model suite and a shared-contract integration suite.
- **Phase 2 — Customer registry.** A canonical `CustomerService` over the
  existing `customers` table (`GET/POST /v1/admin/customers`), and wiring
  checkout to it (pays down the "no real customer registry" tech debt).
- **Phase 3 — Admin bookings.** A staff "book on behalf" flow (list/create/cancel
  over `/v1/admin/bookings`) that reuses the availability engine + occupancy
  recorder without forcing the public payment path.
- **Phase 4 — Admin client + mode switch.** The `ADMIN_DATA_MODE=api` data
  source, API client (auth/session/Host), and DTO mapping; route handlers
  delegated through the seam. Demo stays the default.
- **Phase 5 — Writes/toggles + calendar.** Service/provider/resource updates and
  active toggles over the API; Calendario reads bookings from the API.

## Consequences

- The console can be pointed at the real stack incrementally, entity by entity,
  with each backend addition independently testable before any UI depends on it.
- Until Phases 2–3 land, customers and bookings have no API; in `api` mode those
  screens are explicitly unavailable rather than silently reading a mismatched
  store (no cross-store ID drift).
- Two write paths (console-mapped vs. domain-native) must stay reconciled; the
  mapping lives in one place (the admin API client) to contain it.
- `ADMIN_DATA_MODE`, `API_ORIGIN`, `ADMIN_TENANT_HOST`, `ADMIN_STAFF_EMAIL`,
  `ADMIN_STAFF_PASSWORD` join the operator setup surface (`docs/operations/SETUP.md`).

## Live validation (2026-06-22)

The full `api`-mode chain was exercised end to end against a real stack (PostgreSQL
16 + Redis 7 + the persistent API), the one thing not reproducible earlier:

- Stack stood up in-session with an app role that is `NOSUPERUSER NOBYPASSRLS`
  (not the compose `saas_admin` superuser), so **RLS is genuinely enforced**:
  no tenant context → 0 rows (fail-closed); correct context → visible; another
  tenant's context → 0 rows. This confirms the `TECH_DEBT` RLS blocker is purely
  the superuser role choice, not a policy gap.
- API chain (curl): tenant provision → staff login gate (401/201) → Ubicación →
  Categoría → Servicio → Proveedor (assign + locations) → Agenda → Recurso (hub)
  → Cliente → Disponibilidad (8 slots) → reserva admin no-charge (8→7) → cancel
  (7→8). All persisted in Postgres.
- Console seam (`apps/admin` in `ADMIN_DATA_MODE=api`): all six internal route
  handlers (`/api/{locations,services,providers,resources,customers,bookings}`)
  read real data through `source/* → api-client → API`, and a write through the
  console (`POST /api/locations`) persisted to Postgres. This surfaced and fixed
  the `Host`/undici routing bug above. A regression test
  (`admin-read-model.test.ts`, "resolves the tenant from X-Forwarded-Host") now
  locks the behavior in.

## Alternatives considered

- **Replace the demo store outright.** Rejected: breaks the single-command dev
  loop and would require all of Phases 1–5 atomically before the console runs at
  all.
- **Hydrate the demo store from the API on boot.** Rejected: two sources of
  truth, stale caches, and the same shape-mapping problem without the isolation
  benefits of going through RLS per request.
- **Proxy the browser straight to `/v1/admin/*`.** Rejected: would expose tenant
  Host routing and staff-session handling to the client and bypass the console's
  DTO contract; the server-side seam keeps credentials and mapping server-only.
