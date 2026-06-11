<!--
Sync Impact Report
Version change: 1.0.0 -> 2.0.0
Modified principles:
- Multi-Tenant First -> Tenant Isolation Is Non-Negotiable
- Domain Before Framework -> Domain Engine Before Delivery Channels
- Configurable Vertical Core -> Configurable Vertical Core
- API and Automation as Product Surface -> Enterprise Integrations Are Isolated Adapters
- Observable and Incremental Delivery -> Operational Workflows Are Eventful And Auditable
Added principles:
- Booking Correctness Beats Interface Convenience
Added sections:
- Security And Privacy
Active artifact alignment:
- .specify/templates/plan-template.md reviewed; active plan includes the required constitution checks
- .specify/templates/spec-template.md reviewed; active spec includes tenant, privacy, integration, and audit detail
- .specify/templates/tasks-template.md reviewed; active tasks follow story-phased structure with tests
Follow-up actions: None
-->

# SaaS Reservas Constitution

## Core Principles

### I. Tenant Isolation Is Non-Negotiable
Every persistent, cached, queued, indexed, logged, and stored artifact MUST be tenant-scoped unless it is explicitly platform-global. PostgreSQL tables that store tenant-owned business data MUST include `tenant_id`, MUST be protected by Row-Level Security, and MUST be accessed through a request context that sets `app.current_tenant_id`. Redis keys, object storage paths, webhooks, background jobs, metrics, exports, and audit records MUST carry tenant identity.

### II. Booking Correctness Beats Interface Convenience
The system MUST never confirm a booking, event ticket, package occurrence, resource allocation, or recurrence instance unless availability, provider calendars, shared resources, buffers, external busy windows, payment state, and tenant policies have been validated consistently. Any shortcut that risks double booking, capacity oversell, or stale external calendar state is unconstitutional.

### III. Domain Engine Before Delivery Channels
The booking engine, availability calculation, pricing, package rules, event capacity, waiting list, cancellation, rescheduling, GDPR anonymization, notification decisions, and payment reconciliation MUST live in framework-agnostic domain/application modules. Admin UI, public widgets, staff/customer portals, workers, APIs, and webhooks are delivery channels over that engine.

### IV. Enterprise Integrations Are Isolated Adapters
Payment gateways, calendar providers, meeting providers, WhatsApp Cloud API, email/SMS providers, file scanning, and storage providers MUST be isolated behind adapter interfaces. Credentials MUST be encrypted with envelope/KMS-style key management, scoped to tenant/provider where appropriate, rotated safely, and never leaked into logs or client payloads.

### V. Operational Workflows Are Eventful And Auditable
Every state transition that matters to a tenant or customer MUST emit a domain event and an audit record. This includes booking creation, approval, rejection, cancellation, rescheduling, payment authorization/capture/refund, external sync, webhook receipt, notification dispatch, GDPR anonymization, and waitlist token expiration.

### VI. Configurable Vertical Core
The product MUST serve multiple verticals from a shared model: categories, services, providers, events, resources, extras, custom fields, packages, coupons, tenant policies, templates, and branding. Vertical-specific behavior MUST be expressed through configuration, metadata, capability flags, and policy objects unless a dedicated bounded context is justified in writing.

## Architecture Constraints

- Start as a modular monolith with explicit bounded contexts: identity, tenancy, catalog, scheduling, booking, events, payments, notifications, integrations, files, audit, and billing.
- Use PostgreSQL shared-database tenancy with RLS for v1. Schema-per-tenant can be revisited only with a documented migration and operational need.
- Use Redis for ephemeral slot locks, checkout holds, waitlist tokens, and short-lived coordination keys. Lock keys MUST include `tenant_id` and the relevant provider/resource/time identifiers.
- Use object storage paths of the form `tenants/{tenant_id}/...` and signed URLs with short TTLs for tenant files.
- Use asynchronous workers for notifications, calendar sync, webhook processing, file scanning, recurring jobs, waitlist promotion, and payment reconciliation.
- Support both direct tenant-owned gateway credentials and platform-mediated Stripe Connect-style funds routing.
- Support both platform-shared OAuth apps and tenant-owned OAuth credentials for high-volume calendar tenants.
- WordPress and Amelia are product references only. Their runtime coupling to `wp_users`, plugin hooks, and CMS metadata MUST NOT be reproduced.

## Security And Privacy

- Customer passwordless access MUST use signed short-lived tokens, one-time nonces, first-use revocation, rate limiting, and secure HttpOnly cookies.
- Staff access SHOULD use password-based or stronger tenant-scoped authentication; customer and staff auth models MUST not be accidentally interchangeable.
- GDPR deletion MUST anonymize personal data while preserving non-identifying booking, payment, and reporting records required for tenant operations.
- File uploads MUST validate MIME content, size, tenant quota, and malware scan result before becoming durable tenant objects.
- Payment and OAuth secrets MUST be encrypted at rest and decrypted only transiently in trusted backend execution contexts.

## Delivery Workflow

- Each feature spec MUST identify tenant isolation behavior, domain entities, policies, concurrency controls, external integration effects, failure modes, and audit events.
- Each implementation plan MUST include a constitution check covering RLS, Redis namespacing, credential isolation, event/audit behavior, and background-job behavior.
- Tasks MUST be grouped as independently demonstrable vertical slices and MUST include tests for tenant isolation, booking correctness, and integration boundary behavior.
- Architectural decisions that change tenancy, payment flow, external sync, privacy, or credential handling require a written decision note linked from the relevant spec.

## Governance

This constitution supersedes lower-level implementation preference. Any exception requires a written rationale, explicit risk owner, migration path, and expiry condition. Amendments require updating this file and reviewing all active specs for impact.

**Version**: 2.0.0 | **Ratified**: 2026-06-09 | **Last Amended**: 2026-06-09
