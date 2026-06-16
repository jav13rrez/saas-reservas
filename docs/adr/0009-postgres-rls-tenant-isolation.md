# ADR-0009: PostgreSQL Row-Level Security for Tenant Isolation

**Status:** Accepted  
**Date:** 2026-06-15  
**Tasks:** T001, T080

## Context

The platform is a SaaS multi-tenant system sharing a single PostgreSQL database. Every table that holds tenant-scoped data must ensure one tenant cannot read or write another tenant's rows, even if application-layer filtering is bypassed by a bug.

## Decision

All tenant-scoped tables have a `tenant_id` column and a PostgreSQL Row-Level Security (RLS) policy:

```sql
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bookings
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

The `current_setting('app.tenant_id')` is set at the start of every database transaction via `withTenantContext(executor, tenantId, fn)` from `@saas-reservas/tenant-context`. This function sets the GUC variable and runs the handler inside a transaction; the variable is cleared on transaction end.

All worker jobs must use `runJob` → `withTenantContext`; direct SQL outside that wrapper is forbidden.

## Consequences

- Cross-tenant data leaks are impossible at the database level even if application code has a bug.
- Every query must be issued inside a transaction with the GUC set, adding a small overhead (~0.1 ms per transaction open).
- Migrations must include RLS policies; CI fails if a new table is added without a policy (enforced by a migration lint check).
- Platform-global tables (plans, feature flags) are excluded from RLS and have `SECURITY DEFINER` functions for safe access.
