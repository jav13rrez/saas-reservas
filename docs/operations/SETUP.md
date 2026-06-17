# Operations Setup Checklist

Everything an operator must provision to run the platform: infrastructure,
secrets, environment variables, and external provider accounts. Grounded in the
environment contract (`packages/contracts/src/environment.ts`) and the existing
integration adapters (`packages/integrations`).

The API server (`services/api`) selects its mode from `DATABASE_URL`:

- **persistent** (set): Drizzle/RLS + Redis, environment validated fail-fast.
- **in-memory** (unset): local dev, seeds a demo tenant on port 3001.

Run it with: `pnpm --filter @saas-reservas/api build && pnpm --filter @saas-reservas/api start`.

---

## 1. Infrastructure (required for persistent mode)

- [ ] **PostgreSQL 16** (managed: RDS / Cloud SQL / Supabase / Neon, or
      `docker compose -f infra/docker-compose.yml up -d postgres`). Set `DATABASE_URL`.
- [ ] **Application DB role** that is `NOSUPERUSER NOBYPASSRLS` (RLS is the
      tenant-isolation defense; the app must not bypass it). Use it in `DATABASE_URL`.
- [ ] **Apply migrations** in order: run `infra/postgres/001-*.sql` … `008-*.sql`
      against the database (idempotent).
- [ ] **Redis 7** (managed: Elasticache / Upstash, or the compose service). Set `REDIS_URL`.
- [ ] **Base domain** for tenant subdomains (e.g. `reservas.example`). Set `PLATFORM_BASE_DOMAIN`.

## 2. Cryptographic secrets (generate; store in a secret manager)

```bash
openssl rand -base64 48   # PASSWORDLESS_TOKEN_SECRET (required, min 32)
openssl rand -base64 48   # SESSION_COOKIE_SECRET     (required, min 32)
openssl rand -base64 48   # CREDENTIALS_MASTER_KEY    (optional until integrations are wired)
```

- [ ] `PASSWORDLESS_TOKEN_SECRET` — required.
- [ ] `SESSION_COOKIE_SECRET` — required.
- [ ] `CREDENTIALS_MASTER_KEY` — optional now; required once the integration
      credential vault is wired (in production fronted by a real KMS CMK).

## 3. Object storage (optional until the file-attachment pipeline is wired)

- [ ] S3/GCS bucket + scoped credentials (or local MinIO: `docker compose ... up -d minio`,
      console on `:9001`).
- [ ] Set `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`,
      `STORAGE_SECRET_ACCESS_KEY` (`STORAGE_REGION` defaults to `us-east-1`).

## 4. External provider accounts (per integration — not wired yet; fakes in use)

These adapters exist behind ports but currently use fake implementations. When
the "real adapters" work lands, provision:

### Payments — Stripe
- [ ] Stripe account; enable **Stripe Connect** (charge on behalf of tenants with
      an application fee).
- [ ] Platform **Secret Key** (`sk_live_…`) and **Webhook signing secret** (`whsec_…`).
- [ ] Configure the Stripe webhook endpoint to your API.
- Scope: **global** (platform). Tenants connect via Connect onboarding — they do
  not paste their own secret key.

### Calendars — Google Calendar + Microsoft 365
- [ ] **Google Cloud**: project, OAuth consent screen, OAuth Client ID/Secret with
      Calendar scope, domain verification for push notifications (webhooks).
- [ ] **Microsoft Entra/Graph**: app registration (Client ID/Secret/Tenant) with
      Calendars permissions + change subscriptions (webhooks).
- Scope: **global** shared OAuth app, **or per-tenant** (high-volume tenants bring
  their own). Both supported.

### WhatsApp — Meta Cloud API
- [ ] Meta Business account + WhatsApp Business Account (WABA).
- [ ] Per tenant: **Phone Number ID**, **Permanent Access Token**, **WABA ID**,
      approved message templates.
- Scope: **per-tenant** — entered in the admin and encrypted by the credential vault.

### Email / SMS
- [ ] **Email**: SendGrid (or SES) API key + verified sending domain (SPF/DKIM).
- [ ] **SMS**: Twilio Account SID + Auth Token + sender number.
- Scope: typically **global** (platform sends on behalf of tenants); optionally per-tenant.

### Video meetings
- [ ] Google Meet (via the Google OAuth above) / Zoom (OAuth app) / Teams (Graph).
- Scope: global or per-tenant depending on provider.

### KMS (production credential encryption)
- [ ] **AWS KMS** (or GCP KMS) CMK for the vault's envelope encryption (today an
      in-memory KMS adapter is used). Scope: **global**.

## 5. Global vs per-tenant

- **Global (operator, once):** infrastructure, crypto secrets, KMS, shared OAuth
  app, platform Stripe account, email/SMS provider.
- **Per-tenant (each business, via admin):** WhatsApp credentials, their Stripe
  account (via Connect), optionally their own calendar OAuth — stored **encrypted**
  in the credential vault, never in environment variables.

## 6. Wiring status

- Ready and usable: Postgres+RLS, Redis locks, tenancy, catalog/resource hub,
  bookings, staff auth, server bootstrap (persistent/dev).
- Interface exists, fake in use (needs section 4 accounts/tokens): payments,
  email/SMS/WhatsApp, calendars, video, KMS, file antivirus.

See `.env.example` for the variable template.
