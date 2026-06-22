# ADR-0012: Calendar OAuth Gateway Design

**Status:** Accepted  
**Date:** 2026-06-15  
**Tasks:** T069, T070

## Context

Google Calendar and Microsoft Outlook require OAuth 2.0 Authorization Code flow with PKCE. Tenant credentials (client_id, client_secret) can be either platform-owned (shared across all tenants) or tenant-owned (the tenant registers their own OAuth app for brand ownership). Refresh tokens must survive server restarts and be stored encrypted.

## Decision

`CalendarOAuthGateway` orchestrates:

1. **Authorization URL generation** – builds the provider's authorization URL with state parameter encoding `{tenantId}.{provider}.{nonce}` for CSRF protection.
2. **Token exchange** – swaps the authorization code for access and refresh tokens via the provider's token endpoint.
3. **Token storage** – stores `access_token`, `refresh_token`, `expires_at`, and `scope` in the `EnvelopeCredentialVault` scoped to `(tenantId, provider)` — or `("platform", provider)` for platform-mode credentials.
4. **Token refresh** – called by calendar adapters before any API call; renews via refresh token and updates the vault.

Credential isolation:

- Platform mode: vault key = `("platform", provider, field)` — all tenants share the same app credentials but have independent refresh tokens under their own tenant vault namespace.
- Tenant mode: vault key = `(tenantId, provider, field)` — tenant owns the OAuth app.

Webhook subscriptions (T070) use `InMemoryCalendarMappingStore` in development; production uses the PostgreSQL-backed store with RLS.

## Consequences

- OAuth tokens are never logged or serialized to responses.
- Refresh token rotation is handled atomically within the vault (store new before deleting old).
- A revoked refresh token causes the sync job to emit `calendar.reauth_required`, surfaced to the tenant via the notification system.
- The gateway is provider-agnostic; adding Apple Calendar requires only a new `HttpAdapter` implementation.
