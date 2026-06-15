# Quickstart: Validate SaaS Multitenant Booking Baseline

## Prerequisites

- PostgreSQL with RLS enabled for tenant-owned tables
- Redis available for locks and jobs
- Object storage compatible with `tenants/{tenant_id}/...` paths
- Payment, calendar, WhatsApp, email, and storage adapters can run in fake/sandbox mode

## Validation Scenario 1: Tenant Setup And Availability

1. Create a tenant with timezone, locale, branding, and subdomain.
2. Create one provider with weekly schedule, break, and day off.
3. Create a category, service, extra, and resource with quantity `1`.
4. Query `/public/availability` for the service.
5. Expected: slots respect provider schedule, buffers, resource availability, timezone, and single-provider widget rules.

## Validation Scenario 2: Checkout With Redis Lock And Payment

1. Select one available slot and create a pending booking.
2. Verify Redis lock exists under a tenant-scoped key.
3. Start checkout with fake Stripe/PayPal adapter.
4. Send successful payment webhook.
5. Expected: booking transitions from `Pending` to `Approved`, lock is released, payment transaction is captured, and audit events exist.

## Validation Scenario 3: Cart Partial Refund

1. Create a cart with two bookings and one parent transaction.
2. Allocate subpayments per booking.
3. Cancel one booking inside tenant policy.
4. Expected: refund only affects the canceled booking subpayment and the second booking remains approved.

## Validation Scenario 4: Staff/Customer Change Flow

1. Create an approved booking.
2. Attempt cancellation outside the allowed window.
3. Attempt cancellation inside the allowed window.
4. Expected: first request is rejected with audit; second cancels booking, triggers refund policy, calendar sync, notification jobs, and webhook event.

## Validation Scenario 5: Event Waitlist

1. Create an event with capacity and ticket types.
2. Sell all seats.
3. Add customer to waitlist.
4. Cancel an attendee.
5. Expected: direct sale remains blocked, waitlist customer receives claim token, token expiration promotes next customer.

## Validation Scenario 6: External Calendar Reconciliation

1. Connect fake Google/Outlook calendar.
2. Create booking and external mapping.
3. Simulate external calendar webhook changing the event time.
4. Expected: SaaS booking is updated idempotently and customer notification is queued.

## Validation Scenario 7: Attachment Pipeline

1. Upload a valid attachment through a custom field.
2. Upload a file with valid extension but invalid MIME.
3. Expected: first file passes validation and is stored under `tenants/{tenant_id}/...`; second file is rejected before durable storage.

## Validation Scenario 8: Tenant Isolation

1. Create two tenants with similar services and customers.
2. Query data under tenant A context.
3. Attempt to access tenant B data using tenant A context.
4. Expected: RLS blocks cross-tenant access and no worker/API response leaks tenant B data.

## Validation Scenario 9: Billing Feature Gates

1. Create a tenant on the Starter plan.
2. Attempt to provision a video meeting link for a booking.
3. Attempt to configure a calendar webhook subscription.
4. Upgrade tenant to Enterprise plan.
5. Retry both operations.
6. Expected: Starter plan returns `feature-not-enabled` for `video_meetings`; Enterprise plan succeeds on both. Quota counters reflect actual usage.

## Validation Scenario 10: Worker Idempotency And Retry

1. Enqueue a booking notification job with `idempotencyKey = "notify:bk-1:confirmed"`.
2. Enqueue the same job a second time with the same key.
3. Simulate a transient provider failure on the first attempt.
4. Expected: first execution retries with exponential back-off and succeeds; second enqueue is skipped (`skipped: true`) without calling the handler. No duplicate notifications are sent.

## Validation Scenario 11: Payment Reconciliation

1. Create three bookings with Stripe payment intents.
2. Seed one charge with a mismatched amount and omit one charge entirely.
3. Trigger the reconciliation worker.
4. Expected: one `amount_mismatch` and one `missing_in_stripe` discrepancy are reported in the summary; the third booking shows `ok`. Re-running the reconciliation job with the same `idempotencyKey` is a no-op.

## Validation Scenario 12: Calendar Sync Conflict Detection

1. Connect a provider's Google Calendar with two confirmed overlapping events.
2. Trigger the calendar sync worker.
3. Expected: both events are upserted to the local store and one `CalendarConflict` is returned in the sync summary. All-day events are excluded from conflict detection.

## Validation Scenario 13: Encrypted Credential Vault

1. Store a Stripe API key in the credential vault for a tenant.
2. Read the raw storage blob directly.
3. Tamper with the ciphertext byte.
4. Retrieve the credential via the vault.
5. Expected: raw blob never contains the plaintext; tampered retrieval throws (GCM auth tag mismatch); untampered retrieval returns the original value. Two stores of the same value produce different ciphertexts (fresh IV per write).

## Acceptance Status

| Scenario | Phase | Status |
|----------|-------|--------|
| 1 – Tenant Setup | 1–2 | Implemented (T001–T025) |
| 2 – Checkout + Payment | 3–4 | Implemented (T026–T051) |
| 3 – Cart Partial Refund | 4 | Implemented (T052–T055) |
| 4 – Staff/Customer Change | 4–5 | Implemented (T056–T061) |
| 5 – Event Waitlist | 5 | Implemented (T058–T061) |
| 6 – Calendar Reconciliation | 7 | Implemented (T069–T070) |
| 7 – Attachment Pipeline | 7 | Implemented (T074) |
| 8 – Tenant Isolation | 1–7 | Implemented (T001, T080) |
| 9 – Billing Feature Gates | 8 | Implemented (T076, T084) |
| 10 – Worker Idempotency | 8 | Implemented (T080) |
| 11 – Payment Reconciliation | 8 | Implemented (T082) |
| 12 – Calendar Sync Conflicts | 8 | Implemented (T083) |
| 13 – Credential Vault | 7 | Implemented (T062) |
