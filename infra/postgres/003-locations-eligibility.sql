-- Multi-site locations (model C) and provider-resource eligibility (model B).
-- Additive and idempotent; safe to re-run. Mirrors packages/persistence/src/schema.ts.

-- Locations: physical sites that own resources and host providers (US1 "ubicaciones").
CREATE TABLE IF NOT EXISTS locations (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    name text NOT NULL,
    timezone text,
    address text,
    status text NOT NULL CHECK (status IN ('active', 'inactive'))
);
SELECT apply_tenant_rls('locations');

-- A resource belongs to at most one location (NULL = single-site / unassigned).
ALTER TABLE resources ADD COLUMN IF NOT EXISTS location_id uuid;
CREATE INDEX IF NOT EXISTS idx_resources_tenant_location ON resources (tenant_id, location_id);

-- Provider-resource eligibility: which resources a provider may use. A provider
-- with no rows is unconstrained (may use any resource). When rows exist, the
-- provider may only use the listed resources.
CREATE TABLE IF NOT EXISTS provider_resources (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    provider_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    PRIMARY KEY (tenant_id, provider_id, resource_id)
);
SELECT apply_tenant_rls('provider_resources');
CREATE INDEX IF NOT EXISTS idx_provider_resources_tenant_provider ON provider_resources (tenant_id, provider_id);
