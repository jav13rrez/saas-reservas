# ADR-0019: Real Stripe Connect payment gateway wiring

- Status: Accepted
- Date: 2026-06-19
- Supersedes: none
- Related: ADR-0011 (payment reconciliation), constitution principle IV
  (integrations behind ports), `docs/operations/SETUP.md`

## Context

The `PaymentGateway` port (`packages/integrations/.../payment-gateway.ts`) had
only a `FakePaymentGateway` implementation in both run modes. The first real
adapter in the "real adapter wiring" route (`PLANNING.md` Immediate Route #4) is
Stripe, because the public checkout charges through this port. A Stripe Connect
onboarding service (`StripeConnectService`) already existed but was unreachable:
its `StripeHttpAdapter` had only a fake, with no transport hitting `api.stripe.com`.

## Decision

Add a production Stripe path behind the existing port, with the fake kept as the
default so the single-command dev loop is untouched.

1. **Shared transport** — `FetchStripeHttp` (`packages/integrations/payments/
stripe-http.ts`) implements a `StripeHttpAdapter` moved into the integrations
   package (form-encoded bodies, `Authorization: Bearer`, pinned `Stripe-Version`,
   `Idempotency-Key`, optional `Stripe-Account`). Base URL and `fetch` are
   injectable for tests/mocks. Network failures return a status-0 connection
   error rather than throwing through the port. `StripeConnectService` now imports
   this shared interface (re-exported for back-compat) so the connect service and
   the gateway share one transport.

2. **Gateway** — `StripePaymentGateway` implements `PaymentGateway`:
   - `createCharge` creates a PaymentIntent. When the tenant has an onboarded
     Connect account (vault `(tenantId,"stripe_connect","account_id")`, written by
     `StripeConnectService`) it becomes a **destination charge**:
     `transfer_data[destination]` + `application_fee_amount` from a configurable
     basis-points fee. Without a connected account it falls back to a **plain
     platform charge**, so a single-merchant deployment also works.
   - A supplied `paymentMethod` (new optional, generic field on `ChargeRequest`)
     confirms synchronously (`confirm=true`, `off_session=true`) — covering saved
     methods and Stripe test tokens.
   - Result mapping: `succeeded`/`requires_capture`/`processing` → accepted;
     card errors → `declined`; everything else → `gateway-error`.
   - `refund` reverses the transfer and claws back the application fee
     (`reverse_transfer`, `refund_application_fee`) only for destination charges;
     maps `resource_missing` → `charge-not-found`, `amount_too_large` →
     `exceeds-charge`.
   - The platform secret key is read from the vault (never passed bare); a missing
     key yields `gateway-error`, not a crash.

3. **Boot selection** — `resolvePaymentGateway()` in `services/api/src/main.ts`
   returns `StripePaymentGateway` when `STRIPE_SECRET_KEY` is set (sealing the key
   in an `EnvelopeCredentialVault`), otherwise `FakePaymentGateway`. New optional
   env in the contract: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_APPLICATION_FEE_BPS` (default 0), `STRIPE_API_BASE_URL`.

## Consequences

- The gateway is real and unit/contract tested (recording fake HTTP + injected
  `fetch`). **Live-validated 2026-06-22** (operator machine, test mode): the public
  checkout created a real PaymentIntent (`pi_…`, `amount 3000`, `eur`,
  `requires_payment_method`); gateway selection confirmed (`402` real vs `201`
  fake).
- **Update 2026-06-22 — gaps (b) and (c) resolved:** the public checkout now
  accepts a `paymentMethod` and threads it (+ `metadata.cartId`) through
  `chargeCart` → `createCharge` for synchronous confirmation, and
  `POST /v1/public/payments/stripe-webhook` captures `payment_intent.succeeded`
  (signature-verified via `verifyStripeSignature` when `STRIPE_WEBHOOK_SECRET` is
  set) to approve the booking. Remaining gap **(a)**: the connected-account id is
  read from an in-memory vault at boot, so multi-tenant destination charges still
  need a DB-backed `VaultStorage`. The succeeded flow is also **not yet validated
  against a live Stripe webhook delivery** (`stripe listen`).
- The fake gateway remains the default and the test backbone; nothing in the dev
  loop changed.
