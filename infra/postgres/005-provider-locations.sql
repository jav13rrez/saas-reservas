-- Provider locations (ADR-0016 follow-up).
--
-- A provider works at one or more sites. The hub location-compatibility check
-- intersects a resource's locations with the provider's locations; an empty set
-- on either side means "any location". Additive and idempotent; safe to re-run.

CREATE TABLE IF NOT EXISTS provider_locations (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    provider_id uuid NOT NULL,
    location_id uuid NOT NULL,
    PRIMARY KEY (tenant_id, provider_id, location_id)
);
SELECT apply_tenant_rls('provider_locations');
CREATE INDEX IF NOT EXISTS idx_provider_locations_tenant_provider ON provider_locations (tenant_id, provider_id);
