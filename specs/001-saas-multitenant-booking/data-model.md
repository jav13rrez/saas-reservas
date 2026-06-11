# Data Model: SaaS multitenant de reservas inspirado en Amelia Premium

## Tenant And Identity

### Tenant

- Fields: `id`, `name`, `slug`, `default_timezone`, `default_locale`, `branding`, `status`, `plan_id`, `created_at`, `updated_at`
- Relationships: has many `TenantDomain`, `WorkspaceUser`, `Provider`, `Customer`, `Service`, `Event`, `IntegrationConnection`
- Validation: slug unique globally; timezone required; tenant-owned records must reference tenant.

### TenantDomain

- Fields: `id`, `tenant_id`, `hostname`, `kind`, `verification_status`, `verified_at`
- Relationships: belongs to `Tenant`
- Validation: hostname unique globally; custom domains require verification before routing.

### WorkspaceUser

- Fields: `id`, `tenant_id`, `email`, `role`, `status`, `last_login_at`
- Relationships: belongs to `Tenant`; may map to provider profile
- Validation: email unique per tenant.

### Customer

- Fields: `id`, `tenant_id`, `email`, `first_name`, `last_name`, `phone`, `metadata`, `gdpr_status`, `anonymized_at`
- Relationships: has many `Booking`, `PaymentTransaction`, `WaitlistEntry`
- Validation: personal data must be anonymizable without deleting non-identifying booking metrics.

## Catalog And Scheduling

### Provider

- Fields: `id`, `tenant_id`, `email`, `display_name`, `status`, `timezone`, `permissions`, `metadata`
- Relationships: belongs to `Tenant`; has many `ProviderSchedule`, `ServiceProvider`, `IntegrationConnection`
- Validation: email unique per tenant; appointment services require at least one active assigned provider.

### ProviderSchedule

- Fields: `id`, `tenant_id`, `provider_id`, `weekday`, `start_time`, `end_time`, `breaks`, `kind`, `effective_date`
- Relationships: belongs to `Provider`
- Validation: schedules cannot overlap for the same provider unless marked as exception overrides.

### Category

- Fields: `id`, `tenant_id`, `name`, `sort_order`, `status`
- Relationships: has many `Service`

### Service

- Fields: `id`, `tenant_id`, `category_id`, `name`, `duration_minutes`, `price_amount`, `currency`, `buffer_before_minutes`, `buffer_after_minutes`, `min_capacity`, `max_capacity`, `status`
- Relationships: belongs to `Category`; has many `Extra`, `ServiceProvider`, `ServiceResource`, `Booking`
- Validation: duration positive; max capacity greater than or equal to min capacity.

### Extra

- Fields: `id`, `tenant_id`, `service_id`, `name`, `duration_minutes`, `price_amount`, `multiply_by_people`, `status`
- Relationships: belongs to `Service`
- Validation: package bookings may hide extras and force service base duration depending on package rules.

### Resource

- Fields: `id`, `tenant_id`, `name`, `quantity`, `scope`, `location_id`, `status`
- Relationships: associated to services through `ServiceResource`
- Validation: quantity must be positive; resource allocation is backend-only and not customer-selectable.

## Booking And Payments

### Booking

- Fields: `id`, `tenant_id`, `customer_id`, `service_id`, `provider_id`, `status`, `start_at`, `end_at`, `duration_minutes`, `total_amount`, `currency`, `source`, `metadata`
- Relationships: belongs to `Tenant`, `Customer`, `Service`, `Provider`; has many `BookingExtra`, `PaymentTransaction`, `ExternalCalendarMapping`
- State transitions: `Pending -> Approved`, `Pending -> Rejected`, `Pending -> Expired`, `Approved -> Canceled`, `Approved -> Rescheduled`
- Validation: cannot approve unless availability and payment policy pass.

### CartTransaction

- Fields: `id`, `tenant_id`, `customer_id`, `gateway`, `gateway_transaction_id`, `status`, `total_amount`, `currency`
- Relationships: has many `PaymentTransaction`; may cover multiple `Booking`
- Validation: each booking in a cart must have reconcilable subpayment allocation.

### PaymentTransaction

- Fields: `id`, `tenant_id`, `cart_transaction_id`, `booking_id`, `gateway`, `type`, `status`, `amount`, `currency`, `gateway_reference`, `captured_at`, `refunded_at`
- Relationships: belongs to `Booking` and optionally `CartTransaction`
- Validation: partial refund cannot exceed allocated captured amount.

### Package

- Fields: `id`, `tenant_id`, `name`, `validity_days`, `price_amount`, `currency`, `rules`, `status`
- Relationships: contains multiple services or appointment credits

### Coupon

- Fields: `id`, `tenant_id`, `code`, `discount_type`, `discount_value`, `starts_at`, `ends_at`, `usage_limit`, `status`
- Validation: code unique per tenant while active.

## Events And Waitlist

### Event

- Fields: `id`, `tenant_id`, `series_id`, `name`, `start_at`, `end_at`, `total_capacity`, `min_capacity`, `status`, `recurrence_scope`
- Relationships: has many `TicketType`, `EventAttendee`, `WaitlistEntry`
- Validation: recurring event instances are independent records.

### TicketType

- Fields: `id`, `tenant_id`, `event_id`, `name`, `price_amount`, `capacity`, `dynamic_pricing_rules`, `status`
- Validation: event capacity may be shared or ticket-specific.

### WaitlistEntry

- Fields: `id`, `tenant_id`, `event_id`, `customer_id`, `priority_score`, `status`, `claim_token_hash`, `claim_expires_at`
- State transitions: `Waiting -> Offered -> Approved`, `Offered -> Expired`, `Waiting -> Canceled`
- Validation: offered token must expire and promote next entry automatically.

## Integrations, Files, And Audit

### IntegrationConnection

- Fields: `id`, `tenant_id`, `provider_id`, `kind`, `mode`, `encrypted_credentials`, `health_status`, `last_checked_at`
- Validation: credentials encrypted at rest and redacted from logs.

### ExternalCalendarMapping

- Fields: `id`, `tenant_id`, `booking_id`, `provider_id`, `provider_name`, `external_event_id`, `sync_status`, `last_synced_at`
- Validation: incoming webhook events must map idempotently.

### NotificationTemplate

- Fields: `id`, `tenant_id`, `channel`, `trigger`, `template_external_id`, `placeholders`, `status`

### NotificationJob

- Fields: `id`, `tenant_id`, `channel`, `recipient`, `trigger`, `payload`, `status`, `run_at`, `attempts`, `last_error`

### FileAttachment

- Fields: `id`, `tenant_id`, `customer_id`, `custom_field_id`, `object_key`, `mime_type`, `size_bytes`, `scan_status`, `created_at`
- Validation: durable object key must start with `tenants/{tenant_id}/`.

### AuditEvent

- Fields: `id`, `tenant_id`, `actor_id`, `actor_type`, `event_type`, `subject_type`, `subject_id`, `metadata`, `created_at`
- Validation: must not contain clear-text secrets.
