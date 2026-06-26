-- 011-tenant-currency.sql
-- Feature 003 (tenant-settings): add the tenant-level default currency.
--
-- The tenants registry already co-locates branding/policies/timezone/locale
-- (ADR-0023); currency is the only missing settings field. ISO-4217 code,
-- backfilled to 'EUR' for existing tenants. The tenants registry is
-- platform-global (no RLS), so no policy change is needed.
-- Idempotent: safe to re-run.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';
