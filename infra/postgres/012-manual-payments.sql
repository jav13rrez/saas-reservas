-- Manual payments (feature 004): staff-entered payment records for money taken
-- outside the online gateway (cash, card terminal, bank transfer). One record per
-- booking. Distinct from the gateway cart/subpayment tables so reconciliation is
-- never polluted. Money is integer minor units. Additive and idempotent.

CREATE TABLE IF NOT EXISTS manual_payments (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    booking_id uuid NOT NULL,
    method text NOT NULL CHECK (method IN ('cash', 'card', 'bank_transfer', 'other')),
    status text NOT NULL CHECK (status IN ('paid', 'partial', 'not_paid')),
    amount integer NOT NULL CHECK (amount >= 0),
    deposit integer NOT NULL DEFAULT 0 CHECK (deposit >= 0 AND deposit <= amount),
    currency text NOT NULL,
    transaction_ref text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, booking_id)
);
SELECT apply_tenant_rls('manual_payments');
