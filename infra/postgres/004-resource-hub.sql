-- Resource hub model (ADR-0016).
--
-- The Resource becomes the configuration hub: it declares the services it
-- serves, the sites it exists at, and the providers eligible to use it. These
-- are resource-owned N:M associations, mirroring the admin console hub
-- (apps/admin/src/server/demo-store.ts) and packages/persistence/src/schema.ts.
--
-- Additive and idempotent; safe to re-run.
--
-- Compatibility: the legacy service_resources (service -> resource demand) and
-- provider_resources (provider -> resource eligibility) tables from
-- 003-locations-eligibility.sql, and resources.location_id, are RETAINED. This
-- migration only adds the inverse, resource-owned associations. A later
-- migration may drop the legacy shape once the public widget and Fastify
-- /v1/admin/* routes are cut over to the hub.

-- Services whose bookings consume one unit of the resource (no rows = none).
CREATE TABLE IF NOT EXISTS resource_services (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    resource_id uuid NOT NULL,
    service_id uuid NOT NULL,
    PRIMARY KEY (tenant_id, resource_id, service_id)
);
SELECT apply_tenant_rls('resource_services');
CREATE INDEX IF NOT EXISTS idx_resource_services_tenant_service ON resource_services (tenant_id, service_id);

-- Sites where the resource exists (no rows = any location).
CREATE TABLE IF NOT EXISTS resource_locations (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    resource_id uuid NOT NULL,
    location_id uuid NOT NULL,
    PRIMARY KEY (tenant_id, resource_id, location_id)
);
SELECT apply_tenant_rls('resource_locations');
CREATE INDEX IF NOT EXISTS idx_resource_locations_tenant_resource ON resource_locations (tenant_id, resource_id);

-- Providers eligible to use the resource (no rows = any provider).
CREATE TABLE IF NOT EXISTS resource_employees (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    resource_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    PRIMARY KEY (tenant_id, resource_id, provider_id)
);
SELECT apply_tenant_rls('resource_employees');
CREATE INDEX IF NOT EXISTS idx_resource_employees_tenant_resource ON resource_employees (tenant_id, resource_id);
