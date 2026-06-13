# ADR-0005: First-Party Cookie Sessions With Split Staff/Customer Auth

**Date**: 2026-06-11
**Status**: accepted
**Deciders**: Project owner + agent

## Context

The constitution's Security And Privacy section is prescriptive: customer passwordless access must use signed short-lived tokens, one-time nonces, first-use revocation, rate limiting, and secure HttpOnly cookies; staff access should use password-based or stronger tenant-scoped authentication; the two models must never be interchangeable.

## Decision

Implement first-party auth in the identity bounded context, without an external auth framework:

- **Staff / tenant admin**: email + password (argon2id), tenant-scoped accounts, server-side sessions stored in PostgreSQL with an opaque session ID in a secure HttpOnly SameSite cookie. Roles and permissions are tenant-scoped.
- **Customer passwordless**: signed short-lived link tokens (one-time nonce persisted and revoked on first use), exchanged for a separate customer session cookie with its own name, scope, and shorter TTL.
- **Platform operators**: separate global accounts in platform tables, never mixed with tenant staff.
- No JWTs for browser sessions; signed tokens are used only for passwordless links, webhook signatures, and short-lived internal grants.

## Alternatives Considered

- Auth.js / Lucia / Better Auth: speed up generic auth, but none model tenant-scoped dual staff/customer sessions with first-use revocation cleanly; bending them costs more than building the narrow thing the constitution specifies.
- JWT-based stateless sessions: no server-side revocation, which conflicts with first-use revocation and GDPR/anonymization requirements.
- External IdP (Auth0, Clerk): per-MAU cost across many tenants' customers, and credential/tenant isolation moves outside our audit boundary.

## Consequences

- Auth behavior matches the constitution exactly and is fully testable in integration tests.
- Negative: we own password hashing, session rotation, and rate limiting — these need dedicated security review (already a quality gate).
- Follow-up: ADR when OAuth/social login or MFA for staff is introduced.
