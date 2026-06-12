-- 002-domain.sql
--
-- Domain tables for catalog, scheduling, bookings, payments, events/audit,
-- and webhook idempotency. Follows the conventions of 001-tenancy.sql:
-- tenant-owned tables get tenant_id + apply_tenant_rls(); composite indexes
-- lead with tenant_id. The Drizzle schema in packages/persistence mirrors
-- this file and must be kept in sync.

-- Tenant aggregate columns beyond the registry baseline.
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS default_timezone text NOT NULL DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS default_locale text NOT NULL DEFAULT 'es-ES',
    ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS policies jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Platform-global: hostnames are resolved BEFORE tenant context exists, so
-- this routing table intentionally has no RLS (like the tenants registry).
CREATE TABLE IF NOT EXISTS tenant_domains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    hostname text NOT NULL UNIQUE,
    kind text NOT NULL CHECK (kind IN ('subdomain', 'custom')),
    verification_status text NOT NULL CHECK (verification_status IN ('pending', 'verified'))
);

CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('active', 'inactive'))
);
SELECT apply_tenant_rls('categories');

CREATE TABLE IF NOT EXISTS services (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    category_id uuid NOT NULL,
    name text NOT NULL,
    duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
    price_amount integer NOT NULL CHECK (price_amount >= 0),
    currency text NOT NULL,
    buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0),
    buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0),
    min_capacity integer NOT NULL DEFAULT 1 CHECK (min_capacity >= 1),
    max_capacity integer NOT NULL DEFAULT 1 CHECK (max_capacity >= min_capacity),
    status text NOT NULL CHECK (status IN ('active', 'inactive'))
);
SELECT apply_tenant_rls('services');
CREATE INDEX IF NOT EXISTS idx_services_tenant ON services (tenant_id, status);

CREATE TABLE IF NOT EXISTS extras (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    service_id uuid NOT NULL,
    name text NOT NULL,
    duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
    price_amount integer NOT NULL CHECK (price_amount >= 0),
    multiply_by_people boolean NOT NULL DEFAULT false,
    status text NOT NULL CHECK (status IN ('active', 'inactive'))
);
SELECT apply_tenant_rls('extras');
CREATE INDEX IF NOT EXISTS idx_extras_tenant_service ON extras (tenant_id, service_id);

CREATE TABLE IF NOT EXISTS resources (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    name text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    status text NOT NULL CHECK (status IN ('active', 'inactive'))
);
SELECT apply_tenant_rls('resources');

CREATE TABLE IF NOT EXISTS providers (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    email text NOT NULL,
    display_name text NOT NULL,
    timezone text NOT NULL,
    permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL CHECK (status IN ('active', 'inactive'))
);
SELECT apply_tenant_rls('providers');
CREATE INDEX IF NOT EXISTS idx_providers_tenant ON providers (tenant_id, status);

-- One row per provider; schedule entries (weekly/special-day/day-off) as jsonb.
CREATE TABLE IF NOT EXISTS provider_schedules (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    provider_id uuid NOT NULL,
    entries jsonb NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (tenant_id, provider_id)
);
SELECT apply_tenant_rls('provider_schedules');

CREATE TABLE IF NOT EXISTS service_providers (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    service_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('active', 'inactive')),
    PRIMARY KEY (tenant_id, service_id, provider_id)
);
SELECT apply_tenant_rls('service_providers');

CREATE TABLE IF NOT EXISTS service_resources (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    service_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    units integer NOT NULL DEFAULT 1 CHECK (units > 0),
    PRIMARY KEY (tenant_id, service_id, resource_id)
);
SELECT apply_tenant_rls('service_resources');

CREATE TABLE IF NOT EXISTS bookings (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    customer_id uuid NOT NULL,
    service_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'canceled', 'rescheduled')),
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    duration_minutes integer NOT NULL,
    attendees integer NOT NULL CHECK (attendees >= 1),
    extras jsonb NOT NULL DEFAULT '[]'::jsonb,
    total_amount integer NOT NULL,
    currency text NOT NULL,
    source text NOT NULL CHECK (source IN ('widget', 'admin', 'api'))
);
SELECT apply_tenant_rls('bookings');
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_provider_start ON bookings (tenant_id, provider_id, start_at);

CREATE TABLE IF NOT EXISTS cart_transactions (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    customer_id uuid NOT NULL,
    gateway text NOT NULL,
    gateway_transaction_id text,
    status text NOT NULL CHECK (status IN ('pending', 'authorized', 'captured', 'partially-refunded', 'refunded', 'failed')),
    total_amount integer NOT NULL,
    currency text NOT NULL
);
SELECT apply_tenant_rls('cart_transactions');

CREATE TABLE IF NOT EXISTS sub_payments (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    cart_transaction_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    amount integer NOT NULL,
    refunded_amount integer NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('pending', 'captured', 'partially-refunded', 'refunded'))
);
SELECT apply_tenant_rls('sub_payments');
CREATE INDEX IF NOT EXISTS idx_sub_payments_tenant_cart ON sub_payments (tenant_id, cart_transaction_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_tenant_booking ON sub_payments (tenant_id, booking_id);

-- Outbox + audit (constitution principle V). Append-only.
CREATE TABLE IF NOT EXISTS domain_events (
    event_id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    type text NOT NULL,
    occurred_at timestamptz NOT NULL,
    actor jsonb NOT NULL,
    payload jsonb NOT NULL,
    correlation_id text
);
SELECT apply_tenant_rls('domain_events');
CREATE INDEX IF NOT EXISTS idx_domain_events_tenant_time ON domain_events (tenant_id, occurred_at);

CREATE TABLE IF NOT EXISTS audit_records (
    audit_id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    event_id uuid NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    actor jsonb NOT NULL,
    occurred_at timestamptz NOT NULL,
    metadata jsonb
);
SELECT apply_tenant_rls('audit_records');
CREATE INDEX IF NOT EXISTS idx_audit_records_tenant_entity ON audit_records (tenant_id, entity_type, entity_id);

-- Webhook idempotency: the primary key makes recordIfNew atomic.
CREATE TABLE IF NOT EXISTS processed_webhooks (
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    gateway text NOT NULL,
    event_id text NOT NULL,
    processed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, gateway, event_id)
);
SELECT apply_tenant_rls('processed_webhooks');

-- Confirmed occupancy read by the availability engine (buffers included).
CREATE TABLE IF NOT EXISTS provider_busy (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    provider_id uuid NOT NULL,
    -- Confirmed-booking occupancy is released by booking id on cancel/reschedule.
    booking_id uuid,
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL
);
SELECT apply_tenant_rls('provider_busy');
ALTER TABLE provider_busy ADD COLUMN IF NOT EXISTS booking_id uuid;
CREATE INDEX IF NOT EXISTS idx_provider_busy_tenant_provider ON provider_busy (tenant_id, provider_id, start_at);

CREATE TABLE IF NOT EXISTS resource_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    resource_id uuid NOT NULL,
    booking_id uuid,
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    units integer NOT NULL CHECK (units > 0)
);
SELECT apply_tenant_rls('resource_allocations');
ALTER TABLE resource_allocations ADD COLUMN IF NOT EXISTS booking_id uuid;
CREATE INDEX IF NOT EXISTS idx_resource_allocations_tenant_resource ON resource_allocations (tenant_id, resource_id, start_at);

-- Customers (US3: portals and GDPR anonymization).
CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text,
    gdpr_status text NOT NULL DEFAULT 'active' CHECK (gdpr_status IN ('active', 'anonymized')),
    anonymized_at timestamptz
);
SELECT apply_tenant_rls('customers');
CREATE INDEX IF NOT EXISTS idx_customers_tenant_email ON customers (tenant_id, email);

-- Provisional checkout holds awaiting the payment webhook.
CREATE TABLE IF NOT EXISTS checkout_holds (
    cart_id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    booking_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    occupied jsonb NOT NULL,
    resources jsonb NOT NULL,
    slots jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
SELECT apply_tenant_rls('checkout_holds');
