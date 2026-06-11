# Research: SaaS multitenant de reservas inspirado en Amelia Premium

## Decision: PostgreSQL shared database with Row-Level Security

**Rationale**: The Amelia analysis identifies `Tenant` as the root entity and requires `tenant_id` on tenant-owned tables. A shared PostgreSQL database with RLS gives strong isolation while keeping v1 operationally simpler than schema-per-tenant.

**Alternatives considered**: Application-only tenant filters were rejected because workers and scripts can bypass them. Schema-per-tenant was deferred because it adds migration and operational complexity before scale proves the need.

## Decision: Redis locks for checkout and resource contention

**Rationale**: Booking correctness depends on preventing simultaneous checkout of the same provider/resource/time slot while payment is in flight. Redis locks with tenant-scoped keys and a 10-minute default TTL match the race-condition mitigation in the analysis.

**Alternatives considered**: Database-only validation was rejected because payment latency creates a window where multiple customers could attempt the same scarce slot.

## Decision: Modular monolith first

**Rationale**: The platform has many bounded contexts but strong transactional relationships. A modular monolith keeps domain logic cohesive while allowing workers and adapters to be separately deployable later.

**Alternatives considered**: Microservices-first was rejected because it would spread core booking invariants across network boundaries too early.

## Decision: Stripe Connect preferred, direct checkout supported

**Rationale**: Stripe Connect supports platform fees and tenant payouts. Direct tenant credentials remain useful for tenants that require direct ownership of payment gateway accounts.

**Alternatives considered**: Only direct checkout was rejected because it weakens SaaS monetization. Only platform routing was rejected because some tenants may need direct merchant ownership.

## Decision: Calendar OAuth supports platform and tenant-owned modes

**Rationale**: Platform OAuth is simpler for standard tenants. Tenant-owned OAuth is needed for corporate tenants with high volume, branding needs, or quota isolation.

**Alternatives considered**: A single platform OAuth app was rejected because calendar provider rate limits can create cross-tenant operational risk.

## Decision: Bidirectional calendar sync via webhooks

**Rationale**: Reading external busy blocks only at booking time does not reconcile direct edits in Google/Outlook. Webhook subscriptions and external mappings allow the SaaS to reflect external changes and notify customers.

**Alternatives considered**: Polling-only sync was rejected because it is slower, more expensive at scale, and weaker for customer-facing consistency.

## Decision: Passwordless customer access with signed JWT and one-time nonce

**Rationale**: Customer panel access should be low-friction but secure. Signed short-lived tokens with nonce revocation prevent replay and limit exposure.

**Alternatives considered**: Long-lived magic links were rejected due to replay risk. Password-only customer access was deferred because it adds friction to booking management.

## Decision: Event waitlist with priority and expiring claim token

**Rationale**: The analysis describes protecting released event capacity for waiting-list customers. Priority scoring plus a TTL claim token keeps the process fair and automatable.

**Alternatives considered**: Reopening the slot to public sale was rejected because it ignores waitlist ordering and customer expectations.

## Decision: Attachments require validation pipeline before durable storage

**Rationale**: Custom field attachments are tenant data and security-sensitive. MIME detection, size/quota checks, malware scanning, tenant storage paths, and signed URLs are required.

**Alternatives considered**: Direct browser upload to permanent storage was rejected because malicious or oversized files could become durable before validation.
