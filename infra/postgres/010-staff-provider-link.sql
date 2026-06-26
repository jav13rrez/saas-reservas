-- Migration 010: optional one-to-one link between a staff login and a catalog provider.
-- Both sides remain independent records; the link is the only coupling.

ALTER TABLE staff_accounts
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES providers(id);

-- Partial unique index: enforces one-to-one within a tenant, ignores NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_accounts_provider_tenant
  ON staff_accounts (tenant_id, provider_id)
  WHERE provider_id IS NOT NULL;
