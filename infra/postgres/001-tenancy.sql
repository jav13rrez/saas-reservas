-- 001-tenancy.sql
--
-- PostgreSQL tenancy conventions and RLS policy template (constitution principle I).
--
-- Migration layout
-- ----------------
-- Files in infra/postgres/ are ordered, idempotent-by-review SQL migrations named
-- NNN-topic.sql. They are applied in lexical order by the migration runner and by
-- the local docker compose initialization. Drizzle-generated migrations for domain
-- tables will live alongside them and must follow the conventions below.
--
-- Tenancy conventions
-- -------------------
-- 1. Every tenant-owned table MUST have `tenant_id uuid NOT NULL REFERENCES tenants(id)`.
-- 2. Every tenant-owned table MUST have RLS enabled AND forced (FORCE applies the
--    policy to the table owner as well). Use `apply_tenant_rls(<table>)` below.
-- 3. Composite indexes on tenant-owned tables MUST lead with `tenant_id`.
-- 4. Application code MUST run tenant-owned queries inside a transaction that has
--    executed `SELECT set_config('app.current_tenant_id', '<uuid>', true)` first
--    (transaction-local; equivalent to SET LOCAL).
-- 5. The application MUST connect with a dedicated role WITHOUT the SUPERUSER or
--    BYPASSRLS attributes, e.g.:
--      CREATE ROLE saas_app LOGIN PASSWORD '...' NOSUPERUSER NOBYPASSRLS;
--    Role creation is environment-specific and not part of this migration.
-- 6. Platform-global tables (tenant registry, plans, feature flags, platform users,
--    billing configuration) are the only tables allowed to omit `tenant_id`.

-- Platform-global tenant registry. This table itself is NOT tenant-scoped.
CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
    display_name text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Returns the tenant id bound to the current transaction, or NULL when no tenant
-- context has been set. RLS policies built on this function therefore FAIL CLOSED:
-- without context, `tenant_id = current_tenant_id()` is never true.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

-- RLS policy template. Call this for every tenant-owned table:
--
--     SELECT apply_tenant_rls('bookings');
--
-- It enables and forces row-level security and installs a single ALL policy that
-- restricts both visibility (USING) and writes (WITH CHECK) to the current tenant.
CREATE OR REPLACE FUNCTION apply_tenant_rls(p_table regclass)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_policy text := 'tenant_isolation';
BEGIN
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', v_policy, p_table);
    EXECUTE format(
        'CREATE POLICY %I ON %s AS RESTRICTIVE FOR ALL '
        'USING (tenant_id = current_tenant_id()) '
        'WITH CHECK (tenant_id = current_tenant_id())',
        v_policy, p_table
    );
    -- RESTRICTIVE alone never grants access, so add the permissive side too.
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', v_policy || '_allow', p_table);
    EXECUTE format(
        'CREATE POLICY %I ON %s FOR ALL '
        'USING (tenant_id = current_tenant_id()) '
        'WITH CHECK (tenant_id = current_tenant_id())',
        v_policy || '_allow', p_table
    );
END;
$$;

-- Index convention reminder (applies to future domain migrations):
--
--     CREATE INDEX idx_bookings_tenant_start ON bookings (tenant_id, start_at);
--
-- Never create an index on a tenant-owned table whose leading column is not
-- tenant_id unless a written exception exists in docs/adr/.
