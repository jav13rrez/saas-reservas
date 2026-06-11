# Implementation Plan: SaaS multitenant de reservas inspirado en Amelia Premium para multiples verticales

**Branch**: `001-saas-multitenant-booking` | **Date**: 2026-06-09 | **Spec**: [/home/jav13rrez/saas-reservas/specs/001-saas-multitenant-booking/spec.md](/home/jav13rrez/saas-reservas/specs/001-saas-multitenant-booking/spec.md:1)

**Input**: Feature specification from `/specs/001-saas-multitenant-booking/spec.md`

## Summary

Build a native SaaS booking platform inspired by Amelia Premium but redesigned for multitenant operation. The platform will use Tenant as the root aggregate, PostgreSQL shared-database tenancy with RLS, Redis namespaced locks for checkout and resources, cloud object storage isolated by tenant path, encrypted integration credentials, asynchronous workers, and a modular domain engine for services, providers, resources, bookings, events, packages, payments, notifications, calendar sync, waitlists, recurrence, GDPR, and audit.

The first implementation target is not a WordPress migration. It is a product architecture that preserves Amelia's premium business behavior while replacing WordPress coupling with SaaS-native identity, tenancy, routing, security, automation, and billing boundaries.

## Technical Context

**Language/Version**: TypeScript 5.x preferred for shared contracts across backend, frontend, and workers.

**Primary Dependencies**: Next.js or equivalent frontend shell; NestJS/Fastify or equivalent backend API; PostgreSQL driver/ORM with RLS support; Redis client and queue library; validation library; OpenAPI tooling; encryption/KMS abstraction; payment/calendar/WhatsApp adapters.

**Storage**: PostgreSQL for transactional records; Redis for locks, short TTL tokens, cache, and queues; S3/GCS-compatible object storage for attachments and generated files.

**Testing**: Unit tests for domain policies; integration tests for RLS, availability, Redis locks, booking lifecycle, payment reconciliation, recurrence, waitlist, GDPR; contract tests for payment/calendar/WhatsApp/storage adapters; E2E tests for admin setup and public booking.

**Target Platform**: Linux cloud runtime with reverse proxy that resolves subdomains/custom domains and injects tenant context.

**Project Type**: Modular monolith SaaS with web frontend, backend API, async workers, and shared packages.

**Performance Goals**: Availability lookup p95 under 400 ms for standard tenant workloads; checkout lock acquisition under 100 ms; booking confirmation p95 under 1.5 s excluding external gateway latency; notification jobs processed within 60 seconds of scheduled time for normal load.

**Constraints**: Tenant isolation via RLS and request context; no confirmed booking without availability/payment policy validation; idempotent webhooks; external credentials encrypted; time-zone correctness; audit for critical transitions; no WordPress runtime dependency.

**Scale/Scope**: Initial design target of 100-500 active tenants, thousands of monthly bookings per tenant, multiple verticals, providers per tenant, recurring events, and external integrations.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Tenant Isolation: PASS only if every tenant-owned table, Redis key, storage path, worker payload, webhook, and audit event carries tenant identity.
- Booking Correctness: PASS only if availability calculation accounts for provider schedule, buffers, extras, resources, external busy events, Redis locks, capacity, recurrence, and payment state.
- Domain Engine: PASS only if core policies are implemented outside UI/API controllers and can be tested without HTTP.
- Integration Isolation: PASS only if payment, OAuth, WhatsApp, storage, and notification credentials are encrypted, adapter-based, and tenant/provider scoped.
- Event/Audit: PASS only if booking, payment, notification, webhook, GDPR, recurrence, waitlist, and external sync transitions produce domain events and audit records.
- Configurable Vertical Core: PASS only if vertical-specific fields and behavior use metadata/policies rather than hard-coded forks.

## Architecture Decisions

### Tenancy

- Use shared PostgreSQL database with RLS.
- Set `app.current_tenant_id` per request and per worker job before executing tenant-owned queries.
- Add `tenant_id` to tenant-owned tables and indexes for query performance.
- Use platform-global tables only for platform users, plans, feature flags, tenant registry, and billing configuration.

### Routing And Branding

- Resolve tenants from subdomain, custom domain, or authenticated context.
- Store branding, locale, timezone, translations, domains, and booking-widget settings per tenant.
- Use reverse proxy/header injection only as an optimization; backend MUST still validate tenant identity.

### Availability And Booking

- Calculate total duration as service duration + selected extra durations + before/after buffers.
- Calculate price from base service/event price, extras, attendee count, coupons, deposits, taxes, ticket type, and package rules.
- Use Redis locks before checkout with key shape similar to `lock:{tenant_id}:{provider_id}:{resource_id}:{start_at}` and TTL default 10 minutes.
- Create bookings as `Pending` before payment and move to `Approved`, `Rejected`, `Canceled`, or `Expired` based on deterministic transitions.

### Payments

- Support Stripe/PayPal direct checkout with tenant-owned encrypted credentials.
- Support Stripe Connect-style routing with application fees for platform monetization.
- Model cart parent transactions plus per-booking subpayments for partial refunds and reconciliation.
- Process payment webhooks idempotently.

### Events And Recurrence

- Treat appointments and events as related but separate booking models.
- Model recurring appointments as customer-linked series.
- Model recurring events as independent event instances with optional series relation.
- Support `This only` and `This & future` propagation for recurring events.
- Implement waitlist promotion with priority score, temporary token, TTL, expiration, and notification.

### Integrations

- Calendar integrations support platform OAuth app and tenant-owned OAuth credentials.
- Store external event mappings to detect and reconcile edits from Google/Microsoft webhooks.
- WhatsApp uses Meta Cloud API with tenant-owned Phone Number ID, Permanent Access Token, WABA ID, health check, templates, and placeholder mapping.
- Files go through MIME validation, size/quota enforcement, malware scan, and tenant-isolated object storage.

## Project Structure

### Documentation (this feature)

```text
specs/001-saas-multitenant-booking/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (target)

```text
apps/
├── admin/
├── booking-widget/
├── staff-portal/
└── customer-portal/

services/
├── api/
│   └── src/
│       ├── api/
│       ├── application/
│       ├── domain/
│       ├── infrastructure/
│       └── modules/
└── worker/
    └── src/
        ├── jobs/
        ├── schedulers/
        └── subscribers/

packages/
├── contracts/
├── domain/
├── tenant-context/
├── integrations/
├── persistence/
└── ui/

infra/
├── postgres/
├── redis/
├── object-storage/
└── reverse-proxy/

tests/
├── contract/
├── e2e/
├── integration/
└── unit/
```

**Structure Decision**: Use a modular monolith split by deployable surface and shared packages. Domain and contracts stay independent; API, workers, and UI consume them. This mirrors Amelia's functional breadth while avoiding WordPress/plugin coupling.

## Initial Bounded Contexts

- **Tenancy and Identity**: tenants, domains, users, roles, auth, sessions, customer passwordless links.
- **Catalog**: categories, services, extras, packages, coupons, taxes, vertical metadata.
- **Provider Operations**: providers, schedules, days off, special days, staff permissions.
- **Scheduling**: availability, resources, buffers, locks, recurring appointments, conflict resolution.
- **Booking**: booking state machine, carts, attendees, cancellations, rescheduling, GDPR anonymization.
- **Events**: events, tickets, capacities, waitlist, recurring event propagation.
- **Payments**: gateways, direct credentials, Stripe Connect, deposits, refunds, cart reconciliation.
- **Notifications**: templates, placeholders, email, SMS, WhatsApp, immediate and scheduled jobs.
- **Integrations**: calendar OAuth, external event mappings, videomeetings, incoming/outgoing webhooks.
- **Files**: custom field attachments, quotas, scanning, signed URLs.
- **Audit and Observability**: domain events, audit events, operational logs, metrics.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| RLS plus application tenant context | Defense in depth for multitenant isolation | App-only filters are too easy to bypass in workers/scripts |
| Redis distributed locks | Prevent checkout race conditions for provider/resource slots | Database-only validation is not enough before external payment latency |
| Adapter-based integrations | Tenants need provider choice, credential isolation, and enterprise OAuth | Direct SDK calls inside services would leak external concerns into the domain |
| Parent cart transaction plus subpayments | Partial cancellation/refunds inside carts must be reconcilable | One flat payment row cannot safely refund one booking inside a multi-booking checkout |
