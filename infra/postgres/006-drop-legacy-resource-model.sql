-- Drop the legacy model-B resource tables (ADR-0016 cutover complete).
--
-- The hub read model (resource_services / resource_locations / resource_employees,
-- plus provider_locations) fully replaced the service->resource demand and
-- provider->resource eligibility direction. No code path reads these tables any
-- more, so they are dropped. Destructive and idempotent.

DROP TABLE IF EXISTS provider_resources;
DROP TABLE IF EXISTS service_resources;
