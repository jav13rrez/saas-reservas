/**
 * Tenant context for PostgreSQL access (constitution principle I).
 *
 * Every tenant-owned query must run inside a transaction whose first statement
 * binds `app.current_tenant_id`. RLS policies created by
 * `infra/postgres/001-tenancy.sql` fail closed when the setting is absent.
 *
 * This module is driver-agnostic: it only needs an executor with a
 * `query(sql, params)` method, which `pg`'s Client/PoolClient and Drizzle's
 * session both satisfy or can trivially adapt to.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SqlExecutor {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

export class InvalidTenantIdError extends Error {
  constructor(value: unknown) {
    super(`Invalid tenant id: ${JSON.stringify(value)}; expected a UUID string`);
    this.name = "InvalidTenantIdError";
  }
}

export function isTenantId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function assertTenantId(value: unknown): asserts value is string {
  if (!isTenantId(value)) {
    throw new InvalidTenantIdError(value);
  }
}

/**
 * Binds the tenant id to the current transaction (`set_config(..., true)` is
 * transaction-local, the parameterized equivalent of SET LOCAL). Must be called
 * inside an open transaction; outside one the setting evaporates immediately,
 * which is why callers should prefer `withTenantContext`.
 */
export async function setTenantContext(executor: SqlExecutor, tenantId: string): Promise<void> {
  assertTenantId(tenantId);
  await executor.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
}

/**
 * Reads the tenant id bound to the current transaction, or null when no tenant
 * context is set. Useful for asserting context in workers and tests.
 */
export async function getTenantContext(executor: SqlExecutor): Promise<string | null> {
  const result = (await executor.query(
    "SELECT NULLIF(current_setting('app.current_tenant_id', true), '') AS tenant_id",
  )) as { rows?: { tenant_id: string | null }[] };
  const tenantId = result.rows?.[0]?.tenant_id ?? null;
  return tenantId !== null && isTenantId(tenantId) ? tenantId : null;
}

/**
 * Runs `fn` inside a transaction with tenant context bound before any other
 * statement executes. This is the only sanctioned way for API handlers and
 * worker jobs to touch tenant-owned tables.
 *
 * The executor must be a dedicated connection (e.g. a checked-out PoolClient),
 * never a pool, so BEGIN/COMMIT and the transaction-local setting share one session.
 */
export async function withTenantContext<T>(
  executor: SqlExecutor,
  tenantId: string,
  fn: (executor: SqlExecutor) => Promise<T>,
): Promise<T> {
  assertTenantId(tenantId);
  await executor.query("BEGIN");
  try {
    await setTenantContext(executor, tenantId);
    const result = await fn(executor);
    await executor.query("COMMIT");
    return result;
  } catch (error) {
    await executor.query("ROLLBACK");
    throw error;
  }
}
