# ADR-0020: Brevo transactional email messaging adapter

- Status: Accepted
- Date: 2026-06-22
- Supersedes: none
- Related: ADR-0019 (Stripe gateway wiring, same adapter pattern), constitution
  principle IV (integrations behind ports), `docs/operations/SETUP.md`

## Context

Notifications (booking confirmed / cancelled / rescheduled / reminder / rejected)
flow through the `MessageProvider` port
(`packages/integrations/src/notifications/message-provider.ts`), consumed by the
worker's `dispatchBookingNotification`. Until now the only implementation was
`FakeMessageProvider`, so no real email/SMS is ever sent. The next real adapter
after Stripe (ADR-0019) is messaging.

The owner chose **Brevo** (ex-Sendinblue) over SendGrid/Twilio for its more
generous free tier: **300 transactional emails/day, no expiry**, which covers a
small tenant's booking notifications at no cost. Brevo also offers transactional
SMS, but that is a **paid** channel (credits), so it is out of scope here.

## Decision

Add a real **email-only** Brevo provider behind the existing port, selected at
boot the same way the Stripe gateway is (env-gated, fake stays the default).

- **Transport** (`brevo-http.ts`): `BrevoHttpAdapter` port + `FetchBrevoHttp`,
  a `fetch`-backed client for Brevo's JSON API with the `api-key` header.
  Base URL and `fetch` are injectable (offline unit tests; mockable smoke tests).
  Network failures are mapped to a status-0 response so the provider returns a
  failed `MessageResult` instead of throwing through the port.
- **Provider** (`brevo-message-provider.ts`): `BrevoMessageProvider` implements
  `MessageProvider`. The email channel maps to `POST /v3/smtp/email`
  (`sender`, `to[]`, `subject`, `htmlContent`, optional `textContent`); a
  per-message `from` overrides the configured default sender. Success returns
  `{ ok, providerId: messageId }`; non-2xx maps to `{ ok: false, error }`. The
  **SMS channel returns `{ ok: false, error: "sms-not-supported" }` without
  calling Brevo** — email-only by design.
- **Selection** (`message-provider-factory.ts`): `resolveMessageProvider(config)`
  returns the Brevo provider when `BREVO_API_KEY` is set (fail-fast if
  `MESSAGING_FROM_EMAIL` is missing), else `FakeMessageProvider`. Framework-
  agnostic so the future worker bootstrap selects from env without importing the
  worker runtime.
- **Env contract**: `BREVO_API_KEY`, `MESSAGING_FROM_EMAIL`, `MESSAGING_FROM_NAME`,
  `BREVO_API_BASE_URL` (all optional; validated when present), mirrored in
  `.env.example`.

## Consequences

- Email notifications can run on Brevo's free tier behind the same port; the dev
  loop and tests are untouched (fake stays default).
- **SMS is unimplemented.** `dispatchBookingNotification` builds an SMS message
  when the customer has a phone number; with the Brevo adapter that send fails
  with `sms-not-supported`. Until SMS is wired (paid Brevo SMS or Twilio) or the
  dispatcher is changed to prefer email, customers with a phone on file would not
  be notified. Follow-up: have the dispatcher fall back to email on
  `sms-not-supported`, or gate SMS on a configured SMS provider. Recorded in
  `TECH_DEBT.md`.
- **No worker bootstrap yet.** The factory exists and is tested, but no production
  composition root constructs the worker + provider and consumes a queue. Wiring
  the worker runtime (BullMQ consumers binding `resolveMessageProvider`) is the
  remaining step to make notifications actually send in production.
- The Brevo API key is a platform-level secret held in process env (not the
  per-tenant credential vault); it must never be logged. Per-tenant sender
  identities/credentials, if needed later, would move into the vault.

## Alternatives considered

- **SendGrid / Twilio (the original plan).** Rejected for now on cost: Brevo's
  free email tier is more generous for early tenants. The port is provider-
  agnostic, so a SendGrid adapter can be added later without touching callers.
- **Include Brevo SMS now.** Deferred: SMS is paid, not needed for the free
  end-to-end email path the owner asked to start with.
- **Seal the Brevo key in the credential vault (like the Stripe secret).**
  Deferred: the vault's value is per-tenant credential isolation; a single
  platform email key from env is simpler and acceptable, provided it is never
  logged.
