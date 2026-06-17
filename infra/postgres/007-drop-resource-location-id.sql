-- Drop the superseded single-site column resources.location_id (ADR-0015 model C).
--
-- Multi-site resource placement now lives in resource_locations (004). The column
-- is no longer read by any code path. Dropping it also drops its dependent index
-- idx_resources_tenant_location. Destructive and idempotent.

ALTER TABLE resources DROP COLUMN IF EXISTS location_id;
