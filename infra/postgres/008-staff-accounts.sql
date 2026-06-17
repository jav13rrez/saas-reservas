-- Staff accounts (ADR-0005 / ADR-0017): tenant-scoped email + password auth,
-- distinct from customer passwordless access. Additive and idempotent.
--
-- The password hash is an opaque scrypt string (scrypt$N$r$p$salt$hash). Email
-- is unique per tenant. Sessions are not persisted here (held in the auth
-- service for now); only the durable account records live in PostgreSQL.

CREATE TABLE IF NOT EXISTS staff_accounts (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    email text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'staff')),
    status text NOT NULL CHECK (status IN ('active', 'inactive')),
    UNIQUE (tenant_id, email)
);
SELECT apply_tenant_rls('staff_accounts');
