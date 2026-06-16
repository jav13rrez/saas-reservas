# ADR-0011: Async Payment Reconciliation Strategy

**Status:** Accepted  
**Date:** 2026-06-15  
**Tasks:** T068, T082

## Context

Stripe Connect webhooks deliver payment events asynchronously and with at-least-once semantics. Network failures or Stripe outages mean our internal booking payment status may drift from Stripe's actual charge state. We need a periodic reconciliation pass to detect and surface these discrepancies without manual intervention.

## Decision

A BullMQ worker job (`payment-reconciliation`) runs nightly per tenant:

1. Fetches all `BookingPaymentRecord` rows with status `captured` or `pending` for the current billing period.
2. Calls `StripeChargeRepository.fetchByPaymentIntentIds` (batched to 100 per API call).
3. Runs `reconcilePayments()` which compares internal vs Stripe state and classifies discrepancies as: `ok`, `amount_mismatch`, `missing_in_stripe`, `duplicate_capture`, or `status_mismatch`.
4. Writes a `ReconciliationSummary` to the audit log for operator review.
5. Emits a webhook event `payment.reconciliation_flagged` for each non-`ok` item (so tenants can integrate with their own alerting).

The job runs inside `runJob` for idempotency (idempotencyKey = `${tenantId}:reconcile:${periodStart}`), so a re-triggered run on the same billing period is a no-op.

## Consequences

- Manual payment audits are replaced by an automated nightly report.
- Discrepancies are surfaced within 24 hours rather than discovered reactively.
- False positives can occur when Stripe processes refunds after the reconciliation run; the next nightly run will clear them.
- The job requires a valid Stripe restricted key in the credential vault; if absent, the job is skipped with a `provider-error` result and an alert is raised.
