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
