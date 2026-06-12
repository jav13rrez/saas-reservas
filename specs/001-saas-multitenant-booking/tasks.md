---

description: "Implementation task list for a multitenant Amelia-inspired booking SaaS"

---

# Tasks: SaaS multitenant de reservas inspirado en Amelia Premium para multiples verticales

**Input**: Design documents from `/specs/001-saas-multitenant-booking/`

**Prerequisites**: plan.md, spec.md

**Tests**: Required for tenant isolation, booking correctness, payment reconciliation, external integrations, and privacy flows.

**Organization**: Tasks are grouped by independently demonstrable slices. Each story should be testable without completing lower-priority stories.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean SaaS project skeleton and shared engineering contracts.

- [x] T001 Create target workspace structure and placeholders in `apps/admin/.gitkeep`, `services/api/src/.gitkeep`, `services/worker/src/.gitkeep`, `packages/domain/src/.gitkeep`, and `infra/postgres/.gitkeep`
- [x] T002 Initialize TypeScript workspace tooling in `package.json`, `pnpm-workspace.yaml`, and `tsconfig.base.json`
- [x] T003 [P] Add linting and formatting setup in `eslint.config.js` and `.prettierrc`
- [x] T004 [P] Add unit, integration, contract, and E2E test setup in `vitest.config.ts` and `tests/setup.ts`
- [x] T005 [P] Add environment configuration model in `packages/contracts/src/environment.ts`
- [x] T006 [P] Add OpenAPI contract generation foundation in `packages/contracts/src/openapi.ts`

---

## Phase 2: Foundational Tenant-Safe Platform

**Purpose**: Build the guardrails that every feature depends on.

- [x] T007 Define PostgreSQL tenancy conventions, migration layout, `tenant_id` indexes, and RLS policy template in `infra/postgres/001-tenancy.sql`
- [x] T008 [P] Implement tenant context package that sets and validates `app.current_tenant_id` in `packages/tenant-context/src/tenant-context.ts`
- [x] T009 [P] Implement Redis key namespace helpers for `tenant:{tenant_id}:...` in `packages/tenant-context/src/redis-keys.ts`
- [x] T010 [P] Implement object storage path helpers for `tenants/{tenant_id}/...` and signed URL policy in `packages/tenant-context/src/storage-paths.ts`
- [x] T011 Implement request tenant resolver for subdomain, custom domain, and authenticated context in `services/api/src/infrastructure/tenancy/tenant-resolver.ts`
- [x] T012 Create audit event and domain event primitives in `packages/domain/src/audit/events.ts`
- [x] T013 Add baseline integration tests proving RLS blocks cross-tenant reads/writes in `tests/integration/tenant-rls.test.ts`
- [x] T014 Add baseline worker test proving tenant context is set before tenant-owned database access in `tests/integration/worker-tenant-context.test.ts`

**Checkpoint**: Tenant context, RLS, Redis namespacing, storage namespacing, and audit primitives exist.

---

## Phase 3: User Story 1 - Tenant publica una operacion reservable completa (Priority: P1) 🎯 MVP

**Goal**: Tenant can configure brand, providers, services, resources, schedules, and publish accurate availability.

**Independent Test**: Create tenant, provider, service, schedule, resource, and verify generated public availability.

### Tests for User Story 1

- [x] T015 [P] [US1] Add tests for provider schedule, breaks, days off, special days, and timezone handling in `tests/unit/scheduling/provider-schedule.test.ts`
- [x] T016 [P] [US1] Add tests for service duration, buffers, extras duration, and capacity constraints in `tests/unit/catalog/service-rules.test.ts`
- [x] T017 [P] [US1] Add tests for shared resource blocking across competing services in `tests/integration/scheduling/resource-conflicts.test.ts`
- [x] T018 [P] [US1] Add tests for single-provider widget behavior omitting provider selection in `tests/e2e/booking-widget-single-provider.test.ts`

### Implementation for User Story 1

- [x] T019 [P] [US1] Implement Tenant, TenantDomain, branding, locale, timezone, and policy entities in `packages/domain/src/tenancy/tenant.ts`
- [x] T020 [P] [US1] Implement Provider, ProviderSchedule, day off, special day, and staff permission entities in `packages/domain/src/providers/provider.ts`
- [x] T021 [P] [US1] Implement Category, Service, Extra, Resource, ServiceProvider, and ServiceResource entities in `packages/domain/src/catalog/service.ts`
- [x] T022 [US1] Implement tenant admin services for tenant setup, domain config, branding, and policy management in `services/api/src/application/tenancy/tenant-admin-service.ts`
- [x] T023 [US1] Implement catalog services for categories, services, extras, providers, and resources in `services/api/src/application/catalog/catalog-service.ts`
- [x] T024 [US1] Implement availability engine v1 with provider schedule, buffers, resources, capacity, and timezone support in `services/api/src/application/scheduling/availability-engine.ts`
- [x] T025 [US1] Implement public availability API and admin catalog API in `services/api/src/api/availability-routes.ts`
- [x] T026 [US1] Implement minimal admin setup UI and booking widget availability view in `apps/admin/src/features/tenant-setup/index.tsx`

**Checkpoint**: Tenant inventory is publishable and availability respects core rules.

---

## Phase 4: User Story 2 - Cliente reserva, paga y recibe confirmacion transaccional (Priority: P2)

**Goal**: Customer can reserve one or multiple services with extras, coupons, deposits, Redis locks, payment, and confirmation.

**Independent Test**: Execute cart checkout with multiple bookings, payment webhook, subpayments, and lock release behavior.

### Tests for User Story 2

- [ ] T027 [P] [US2] Add tests for total duration formula with extras and buffers in `tests/unit/bookings/booking-duration.test.ts`
- [ ] T028 [P] [US2] Add tests for pricing with attendees, extras, coupons, deposits, taxes, and packages in `tests/unit/payments/pricing-service.test.ts`
- [ ] T029 [P] [US2] Add concurrency tests for Redis lock acquisition, rejection, TTL expiration, and release in `tests/integration/scheduling/redis-locks.test.ts`
- [ ] T030 [P] [US2] Add booking state machine tests for Pending, Approved, Rejected, Expired, Canceled in `tests/unit/bookings/booking-state-machine.test.ts`
- [ ] T031 [P] [US2] Add cart parent transaction and subpayment refund tests in `tests/integration/payments/cart-reconciliation.test.ts`

### Implementation for User Story 2

- [ ] T032 [P] [US2] Implement Customer, Booking, BookingAttendee, BookingExtra, and BookingState entities in `packages/domain/src/bookings/booking.ts`
- [ ] T033 [P] [US2] Implement Package, Coupon, CartTransaction, PaymentTransaction, and SubPayment entities in `packages/domain/src/payments/payment.ts`
- [ ] T034 [US2] Implement Redis checkout lock service with tenant/provider/resource/time key composition in `services/api/src/application/scheduling/checkout-lock-service.ts`
- [ ] T035 [US2] Implement booking application service for pending creation, approval, rejection, expiration, and audit in `services/api/src/application/bookings/booking-service.ts`
- [ ] T036 [US2] Implement pricing service for standard booking, packages, coupons, deposits, and taxes in `services/api/src/application/payments/pricing-service.ts`
- [ ] T037 [US2] Implement payment adapter interfaces and fake gateway for tests in `packages/integrations/src/payments/payment-gateway.ts`
- [ ] T038 [US2] Implement Stripe/PayPal direct checkout adapter boundary and webhook idempotency model in `services/api/src/infrastructure/payments/payment-webhooks.ts`
- [ ] T039 [US2] Implement cart reconciliation and partial refund service in `services/api/src/application/payments/cart-reconciliation-service.ts`
- [ ] T040 [US2] Implement public booking checkout API and booking widget checkout UI in `apps/booking-widget/src/features/checkout/index.tsx`

**Checkpoint**: Customer checkout is transactionally safe and payment-aware.

---

## Phase 5: User Story 3 - Staff y clientes gestionan cambios con politicas y privacidad (Priority: P3)

**Goal**: Staff and customers can cancel, reschedule, access portals, and execute privacy flows under tenant policies.

**Independent Test**: Cancel/reschedule approved booking under policies, process refund, update external mapping placeholder, and anonymize customer.

### Tests for User Story 3

- [ ] T041 [P] [US3] Add tests for minimum cancel/reschedule windows and rejected attempts in `tests/unit/bookings/change-policy.test.ts`
- [ ] T042 [P] [US3] Add tests for passwordless JWT nonce TTL, first-use revocation, replay rejection, and secure session creation in `tests/integration/identity/customer-passwordless.test.ts`
- [ ] T043 [P] [US3] Add tests for GDPR anonymization preserving non-identifying booking/payment metrics in `tests/integration/privacy/gdpr-anonymization.test.ts`
- [ ] T044 [P] [US3] Add tests for cancellation/refund event emission and audit records in `tests/integration/bookings/cancellation-audit.test.ts`

### Implementation for User Story 3

- [ ] T045 [US3] Implement cancel and reschedule policy engine in `services/api/src/application/bookings/change-policy-engine.ts`
- [ ] T046 [US3] Implement customer passwordless access service with asymmetric JWT and one-time nonce in `services/api/src/application/identity/customer-passwordless-service.ts`
- [ ] T047 [US3] Implement staff portal permission checks and provider calendar management services in `services/api/src/application/providers/provider-portal-service.ts`
- [ ] T048 [US3] Implement cancellation and reschedule application services with payment/refund hooks in `services/api/src/application/bookings/booking-change-service.ts`
- [ ] T049 [US3] Implement GDPR anonymization service for Customer, custom fields, and historical bookings in `services/api/src/application/privacy/gdpr-anonymization-service.ts`
- [ ] T050 [US3] Implement customer portal and staff portal API surfaces in `services/api/src/api/portal-routes.ts`

**Checkpoint**: Post-booking operations are policy-safe, auditable, and privacy-aware.

---

## Phase 6: User Story 4 - Tenant vende eventos, tickets, recurrencias y lista de espera (Priority: P4)

**Goal**: Tenant can sell events with tickets, dynamic pricing, recurrence, capacity, and waitlist promotion.

**Independent Test**: Sell out an event, promote waitlist entry with TTL token, and process recurring event update scopes.

### Tests for User Story 4

- [ ] T051 [P] [US4] Add event capacity, ticket category, and attendee limit tests in `tests/unit/events/event-capacity.test.ts`
- [ ] T052 [P] [US4] Add early-bird and dynamic event pricing tests in `tests/unit/events/event-pricing.test.ts`
- [ ] T053 [P] [US4] Add waitlist priority, token TTL, expiration, and promotion tests in `tests/integration/events/waitlist-promotion.test.ts`
- [ ] T054 [P] [US4] Add recurring event `this only` and `this & future` propagation tests in `tests/integration/events/recurring-event-propagation.test.ts`
- [ ] T055 [P] [US4] Add recurring appointment conflict strategy tests in `tests/unit/scheduling/recurring-appointment-conflicts.test.ts`

### Implementation for User Story 4

- [ ] T056 [P] [US4] Implement Event, TicketType, EventAttendee, EventSeries, and WaitlistEntry entities in `packages/domain/src/events/event.ts`
- [ ] T057 [US4] Implement event capacity and ticket pricing service in `services/api/src/application/events/event-pricing-service.ts`
- [ ] T058 [US4] Implement waitlist service with priority score, token generation, TTL, and promotion job in `services/api/src/application/events/waitlist-service.ts`
- [ ] T059 [US4] Implement recurring appointment conflict resolver with suggest/omit strategies in `services/api/src/application/scheduling/recurrence-conflict-resolver.ts`
- [ ] T060 [US4] Implement recurring event propagation service for current/future instances in `services/api/src/application/events/recurring-event-service.ts`
- [ ] T061 [US4] Implement admin event APIs and public event booking flow in `services/api/src/api/event-routes.ts`

**Checkpoint**: Events and ticketing support premium operational behavior.

---

## Phase 7: User Story 5 - Integraciones premium operan de forma segura y escalable (Priority: P5)

**Goal**: Tenant can connect payments, calendars, videomeetings, WhatsApp, files, and webhooks safely.

**Independent Test**: Connect sandbox providers, simulate external webhooks, verify encrypted credentials, audit, retry, and tenant isolation.

### Tests for User Story 5

- [ ] T062 [P] [US5] Add tests verifying encrypted credential storage and redacted logs in `tests/integration/security/credential-vault.test.ts`
- [ ] T063 [P] [US5] Add calendar OAuth platform-mode and tenant-owned OAuth contract tests in `tests/contract/integrations/calendar-oauth.test.ts`
- [ ] T064 [P] [US5] Add external calendar webhook idempotency and reconciliation tests in `tests/integration/integrations/calendar-webhooks.test.ts`
- [ ] T065 [P] [US5] Add WhatsApp health check, template mapping, and dispatch tests in `tests/contract/integrations/whatsapp-cloud.test.ts`
- [ ] T066 [P] [US5] Add attachment MIME, size, quota, malware-scan, and signed URL tests in `tests/integration/files/attachment-pipeline.test.ts`

### Implementation for User Story 5

- [ ] T067 [US5] Implement encrypted credential vault abstraction and KMS-compatible interface in `packages/integrations/src/security/credential-vault.ts`
- [ ] T068 [US5] Implement Stripe Connect-style account connection and application fee model in `services/api/src/application/payments/stripe-connect-service.ts`
- [ ] T069 [US5] Implement calendar OAuth gateway with platform and tenant-owned credential modes in `packages/integrations/src/calendar/calendar-oauth-gateway.ts`
- [ ] T070 [US5] Implement external calendar mapping and webhook receiver for Google/Microsoft changes in `services/api/src/api/calendar-webhook-routes.ts`
- [ ] T071 [US5] Implement videomeeting adapter boundary for Meet, Zoom, and Teams in `packages/integrations/src/meetings/meeting-provider.ts`
- [ ] T072 [US5] Implement WhatsApp Cloud API integration health check, template sync, and placeholder mapping in `packages/integrations/src/notifications/whatsapp-cloud.ts`
- [ ] T073 [US5] Implement email/SMS notification adapter boundaries in `packages/integrations/src/notifications/message-provider.ts`
- [ ] T074 [US5] Implement attachment validation, antivirus scan boundary, quota enforcement, and object storage persistence in `services/api/src/application/files/attachment-service.ts`
- [ ] T075 [US5] Implement outbound webhook subscriptions and retry policy in `services/worker/src/jobs/outbound-webhook-dispatcher.ts`

**Checkpoint**: Premium integrations are tenant-scoped, secure, and observable.

---

## Phase 8: Observability, Billing, And Product Readiness

**Purpose**: Make the SaaS operable, billable, and reviewable.

- [ ] T076 Add tenant billing plan, feature flag, quota, and usage event model in `packages/domain/src/billing/billing.ts`
- [ ] T077 Add operational dashboards for booking failures, webhook failures, notification failures, and integration health in `apps/admin/src/features/operations/index.tsx`
- [ ] T078 Add audit search APIs for tenant admins and platform operators in `services/api/src/api/audit-routes.ts`
- [ ] T079 Add seed/demo tenant scenarios for clinic, salon, consultant, event organizer, and pet service verticals in `services/api/src/seeds/demo-tenants.ts`
- [ ] T080 Add tenant-aware async job queue primitives, retry policy, idempotency keys, and worker tenant context bootstrap in `services/worker/src/infrastructure/jobs/job-runner.ts`
- [ ] T081 Add booking notification orchestration for added, approved, rejected, rescheduled, canceled, payment captured, refunded, and failed events in `services/worker/src/jobs/booking-notification-dispatcher.ts`
- [ ] T082 Add payment reconciliation worker for delayed gateway confirmation, failed webhook replay, refund reconciliation, and cart/subpayment consistency in `services/worker/src/jobs/payment-reconciliation.ts`
- [ ] T083 Add calendar synchronization worker for outbound booking pushes, external busy-window reconciliation, webhook recovery, and videomeeting update propagation in `services/worker/src/jobs/calendar-sync.ts`
- [ ] T084 Add videomeeting provisioning service invoked from booking approval and reschedule flows in `services/api/src/application/integrations/videomeeting-provisioning-service.ts`
- [ ] T085 Add ADRs for RLS tenancy, Redis lock strategy, payment reconciliation, OAuth gateway, worker idempotency, and GDPR anonymization in `docs/adr/0001-saas-architecture-baseline.md`
- [ ] T086 Validate all success criteria from `spec.md` with automated or documented checks in `specs/001-saas-multitenant-booking/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 can start immediately.
- Phase 2 blocks every user story because tenant context and isolation are foundational.
- US1 blocks US2 because checkout depends on publishable services/providers/resources.
- US2 blocks full US3 cancellation/refund behavior.
- US4 can start after US1 and part of US2, but event payments require payment infrastructure.
- US5 can develop adapter boundaries alongside US2-US4 after credential vault exists; production readiness depends on tenant-aware worker hardening in Phase 8.
- Phase 8 depends on enough domain events and usage events to measure, then closes asynchronous processing, reconciliation, and observability gaps.

### Parallel Opportunities

- Infrastructure helpers in Phase 2 can be developed in parallel after conventions are agreed.
- Domain entities within a story can be implemented in parallel.
- Adapter contract tests can be written before real provider integrations.
- UI surfaces can begin after API contracts stabilize for each story.

### Implementation Strategy

1. Establish tenant-safe foundations with RLS, request context, Redis naming, storage naming, events, and audit.
2. Deliver US1 as the first demonstrable MVP: tenant setup and real availability.
3. Add US2 checkout with Redis locks and payment lifecycle.
4. Add US3 portals, policy changes, refunds, and GDPR.
5. Add US4 events, recurrence, and waitlists.
6. Add US5 premium integrations and adapter boundaries.
7. Finish with billing, quotas, dashboards, worker hardening, reconciliation, ADRs, and demo tenants.

### Notes

- Treat the Amelia analysis as behavioral input, not source architecture.
- Never merge tenant-owned data paths without tenant identity.
- Write failure-mode tests before provider integrations.
- Prioritize correctness and auditability over UI breadth during the first implementation wave.
