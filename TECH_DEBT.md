# Technical Debt — Pre-Production Ledger

Last updated: 2026-06-19

Cumulative register of known shortcuts, simplifications, and dev-only choices
that MUST be reviewed (and most resolved) **before a real production launch on a
VPS**. This is the flow document for "what is not production-ready yet".

How to use this file:

- Add an entry the moment a debt is introduced or discovered, with enough
  context to act on it later. Keep entries factual.
- Mark severity: **[BLOCKER]** (must fix before any real traffic), **[HIGH]**
  (fix before serious use), **[MEDIUM]** (improve soon), **[LOW]** (nice to have).
- When a debt is paid, move it to "Resolved" with the date and how.
- Cross-reference ADRs / `HANDOFF.md` where relevant.

---

## Security & tenant isolation

- **[BLOCKER] Local Postgres role is a superuser.** The Docker dev role
  `saas_admin` is a superuser, so it **bypasses RLS** — tenant isolation is not
  actually enforced locally. Production MUST use a dedicated application role
  that is `NOSUPERUSER NOBYPASSRLS` (see `docs/operations/SETUP.md` §1) and run
  the app exclusively through it. RLS is the primary tenant-isolation defense.
  _Validated 2026-06-22:_ running the stack with a `NOSUPERUSER NOBYPASSRLS`
  `saas_app` role makes RLS enforce correctly (fail-closed without tenant context;
  isolation across tenants), confirming this is purely a role-choice fix — no
  policy gap. The compose default still ships the superuser role, so the blocker
  stands for any deployment that reuses it.
- **[HIGH] Staff sessions live in an in-memory per-process map** (ADR-0017).
  Sessions are lost on API restart and do not work across multiple API
  instances / behind a load balancer. Needs a shared, persistent session store
  (Redis or Postgres) before horizontal scaling or zero-downtime deploys.
- **[HIGH] No login rate limiting** for staff auth (`/v1/admin/sessions`)
  (ADR-0017). Add throttling / lockout before exposing the admin surface.
- **[MEDIUM] Password hashing uses scrypt, not argon2id** (ADR-0017) — chosen
  because argon2 had no native build in the dev environment. Re-evaluate
  argon2id for production.
- **[MEDIUM] Staff portal still uses the dev-only `x-provider-id` header** and
  is not migrated to real staff sessions.
- **[MEDIUM] Checkout is not wired to the customer registry.** A canonical
  customer registry now exists (`CustomerService`, `GET/POST /v1/admin/customers`,
  ADR-0018 Phase 2), but checkout still assigns `customerId: randomUUID()` per
  booking (`checkout-routes.ts`) instead of resolving/creating a registry
  customer. Wire checkout to the registry (match by email, create if absent).

## Integration adapters (all fakes today)

These ports are implemented but wired to fake adapters in every mode. Each needs
a real implementation + the provider account/credentials in
`docs/operations/SETUP.md` §4 before launch.

- **[HIGH] Payments:** `StripePaymentGateway` is wired (ADR-0019, selected by
  `STRIPE_SECRET_KEY`; fake stays default) but **not yet validated against live
  Stripe**, and three gaps remain before real money moves safely:
  - **[BLOCKER] Connected-account resolution is in-memory.** The boot vault
    (`resolvePaymentGateway`) only holds the platform secret key, so per-tenant
    `stripe_connect/account_id` ids do not resolve in production — destination
    charges silently fall back to plain platform charges. Needs a DB-backed
    `VaultStorage` before multi-tenant Connect payouts.
  - **[BLOCKER] No payment method in the public checkout.** `createCharge`
    confirms synchronously only when a `paymentMethod` is supplied; the real
    checkout still needs the client-confirm + webhook-capture flow to pass one.
  - **[HIGH] Stripe webhook signatures are not verified.** `STRIPE_WEBHOOK_SECRET`
    is in the env contract but the webhook processor does not yet enforce it.
  - **[MEDIUM] Checkout reports infrastructure errors as card declines.** The
    public checkout (`checkout-routes.ts`) collapses any cart charge failure into
    `402 payment-declined`, including the gateway's `gateway-error` outcome
    (Stripe unreachable / 5xx / connectivity). A Stripe outage therefore looks to
    the customer like a declined card and is indistinguishable in logs. Surface
    `gateway-error` distinctly (e.g. `502/503`, retriable) vs. real declines.
    Found during the 2026-06-22 live validation (egress to `api.stripe.com` is
    blocked in the session environment, which exercised this exact path).
  - **[INFRA] `api.stripe.com` not in the session egress allowlist.** The live
    Stripe test-mode smoke could not run inside the dev container because outbound
    `api.stripe.com` is blocked by the environment network policy. Allowlist the
    host (or run the smoke on the operator's machine) to validate the real gateway
    round-trip; the key/account themselves were not exercised.
- **[HIGH] Email / SMS:** `FakeMessageProvider` → SendGrid/SES + Twilio.
- **[HIGH] Credential vault KMS:** `InMemoryKmsAdapter` → AWS/GCP KMS CMK.
  `CREDENTIALS_MASTER_KEY` is currently optional and only validated when present.
- **[MEDIUM] WhatsApp:** fake → Meta Cloud API (per-tenant credentials).
- **[MEDIUM] Calendars:** fake HTTP → Google Calendar + Microsoft Graph OAuth +
  push webhooks.
- **[MEDIUM] Video meetings:** fake → Google Meet / Zoom / Teams.
- **[MEDIUM] File storage + antivirus:** `FakeStorageAdapter` /
  `FakeAntivirusAdapter` → S3/GCS + a real scanner before accepting uploads.

## Persistence & migrations

- **[HIGH] Events context persistence is in-memory.** Events, ticket types,
  attendees, series, and the waitlist run behind `EventStore`/`WaitlistStore`
  ports with in-memory adapters only; Drizzle tables for the events context are
  not built yet. Event data does not survive a restart in persistent mode.
- **[HIGH] No migration runner.** SQL migrations (`infra/postgres/00*.sql`) are
  applied operationally — automatically only on a Postgres **first boot** with an
  empty volume (`docker-entrypoint-initdb.d`), or manually otherwise. There is no
  versioned migration tool to apply incremental changes to an existing managed
  database. Needs a real migration process (ordering, idempotency, history)
  before the schema evolves in production.

## Developer experience / onboarding gotchas

- **[LOW] API JSON responses embed `actor.id` before the entity `id`.** Admin
  create responses serialize the audit `actor` (the staff member) before the
  created entity's own `id` — e.g.
  `{... "actor":{"type":"staff","id":"<staffId>"}, "id":"<entityId>" ...}`.
  Naive shell parsing like `grep '"id"' | head -1` therefore captures the
  **staff id**, not the entity id. This bit us during operator onboarding
  (wrong service/provider ids → failed assign → `service-not-found`).
  Workarounds: parse with `jq -r .id`, use `tail -1`, or read ids from Postgres.
  Longer-term consideration: stop echoing the full `actor` in responses, or
  return the entity under an unambiguous key so id extraction is robust.

## Admin ↔ persistent API integration (ADR-0018)

- **[MEDIUM] `api`-mode admin uses a shared staff service-account credential.**
  When `ADMIN_DATA_MODE=api`, `apps/admin` authenticates to the API with a single
  `ADMIN_STAFF_EMAIL`/`ADMIN_STAFF_PASSWORD` and caches one process-wide
  `staff_session`. There is no per-operator login UI yet, so admin actions are not
  attributable to individual humans and the credential sits in the admin's env.
  Replace with a real operator login before multi-user admin use.
- **[MEDIUM] Customers and Bookings screens have no API yet.** In `api` mode they
  cannot be backed by the persistent stack until ADR-0018 Phases 2–3 land
  (customer registry, admin "book on behalf"). Today only Locations is wired
  through the data-source seam; the rest still read the demo store.
- **[RESOLVED 2026-06-22] `api`-mode admin client validated end to end.** Ran the
  console in `ADMIN_DATA_MODE=api` against a real PostgreSQL+Redis+API stack: all
  six internal route handlers read real data and a console write persisted to
  Postgres. This surfaced and fixed a blocking bug — the client routed the tenant
  via `Host`, which `undici` strips (forbidden fetch header), so every call got
  `404 unknown-host`; it now sends `X-Forwarded-Host` and the API tenant hook
  prefers a validated `X-Forwarded-Host` over `Host` (ADR-0018). Regression test
  added (`admin-read-model.test.ts`). NOTE: production edge proxy MUST strip
  inbound `X-Forwarded-Host` and set its own before the API hop.
- **[MEDIUM] Admin no-charge booking takes no slot lock.** Unlike public checkout,
  `AdminBookingService` validates availability and records occupancy immediately
  with no Redis lock, so two simultaneous admin bookings for the same slot could
  both pass the check. Acceptable for a single trusted operator (ADR-0018); add a
  lock if admin booking becomes concurrent/multi-user.
- **[LOW] Admin booking date is derived from the UTC date of `startAt`.** The
  admin `source/bookings.ts` derives the availability-query `date` from the UTC
  calendar date, which can be off by one for late-evening slots in eastern
  offsets. Fine for the demo Europe/Madrid daytime case; pass the picked date
  explicitly when the booking UI is timezone-aware.

## Deferred product features

- **[MEDIUM] Resource quantity partition** (`shared` / `per-service` /
  `per-location`) — deferred (ADR-0016).
- **[MEDIUM] Group booking** — deferred (ADR-0016).
- **[MEDIUM] Per-provider scheduling UI** — Work hours / Days off / Special days
  are a known gap vs. Amelia (`docs/analysis/amelia-ux-reference.md`).

---

## Resolved

_(Move paid-off debts here with date + resolution.)_
</content>
</invoke>
