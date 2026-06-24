-- Platform operators (ADR-0022 / feature 002): the platform-global superadmin
-- identity, distinct from tenant-scoped staff_accounts. Like tenants and
-- tenant_domains this table is PLATFORM-GLOBAL: it carries no tenant_id and is
-- deliberately NOT placed under apply_tenant_rls — row-level security keys off
-- current_tenant_id() and would fail-closed for a table with no tenant column.
-- Additive and idempotent.
--
-- The password hash is an opaque scrypt string (scrypt$N$r$p$salt$hash), the
-- same self-describing format as staff_accounts (ADR-0017). Sessions are not
-- persisted here (held in the platform auth service for now); only the durable
-- operator records live in PostgreSQL. No credential/secret is stored in source.

CREATE TABLE IF NOT EXISTS platform_operators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password_hash text NOT NULL,
    display_name text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email is unique platform-wide (no tenant dimension). Lowercase is enforced by
-- the application layer (normalizePlatformEmail); the index is plain unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_operators_email ON platform_operators (email);

-- Tenant lifecycle status: confirm the column the resolver already honors exists
-- with the active/suspended values feature 002 relies on. 001-tenancy.sql already
-- defines status with a CHECK over ('active','suspended','archived') and a default
-- of 'active'; this block is a defensive, idempotent no-op for older databases.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants' AND column_name = 'status'
    ) THEN
        ALTER TABLE tenants
            ADD COLUMN status text NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'suspended', 'archived'));
    END IF;
END
$$;
