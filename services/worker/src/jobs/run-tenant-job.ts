/**
 * Tenant-scoped job execution wrapper.
 *
 * Every BullMQ job payload carries `tenantId` (ADR-0004). This wrapper is the
 * only sanctioned path from a job handler to tenant-owned tables: it validates
 * the payload's tenant id and binds the PostgreSQL tenant context before the
 * handler runs a single query, so RLS fails closed for malformed payloads.
 */

import { assertTenantId, withTenantContext, type SqlExecutor } from "@saas-reservas/tenant-context";

export interface TenantJobPayload {
  tenantId: string;
}

export type TenantJobHandler<P extends TenantJobPayload, T> = (
  executor: SqlExecutor,
  payload: P,
) => Promise<T>;

export async function runTenantJob<P extends TenantJobPayload, T>(
  executor: SqlExecutor,
  payload: P,
  handler: TenantJobHandler<P, T>,
): Promise<T> {
  // Reject before touching the database at all.
  assertTenantId((payload as Partial<TenantJobPayload>).tenantId);
  return withTenantContext(executor, payload.tenantId, (tx) => handler(tx, payload));
}
