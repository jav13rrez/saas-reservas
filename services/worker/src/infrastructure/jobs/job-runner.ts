/**
 * Tenant-aware async job queue primitives (T080).
 *
 * Extends the base runTenantJob wrapper with:
 *  - Idempotency keys: a job with the same (tenantId, jobType, idempotencyKey)
 *    is skipped if already processed (at-most-once per key).
 *  - Retry policy: configurable max attempts with exponential back-off.
 *  - Worker context bootstrap: validates payload, binds tenant context, wraps
 *    handler result in a JobResult envelope for observability.
 *
 * All jobs must embed TenantJobPayload and pass through runTenantJob or this
 * runner — never execute tenant queries outside that binding.
 */

import { assertTenantId, withTenantContext, type SqlExecutor } from "@saas-reservas/tenant-context";

// ---------------------------------------------------------------------------
// Base payload
// ---------------------------------------------------------------------------

export interface TenantJobPayload {
  tenantId: string;
  jobType: string;
  /** Stable key for at-most-once deduplication within (tenantId, jobType). */
  idempotencyKey: string;
  /** ISO timestamp when the job was enqueued. */
  enqueuedAt: string;
}

// ---------------------------------------------------------------------------
// Idempotency store port
// ---------------------------------------------------------------------------

export interface JobIdempotencyStore {
  hasProcessed(tenantId: string, jobType: string, idempotencyKey: string): Promise<boolean>;
  markProcessed(
    tenantId: string,
    jobType: string,
    idempotencyKey: string,
    result: "success" | "failed",
  ): Promise<void>;
}

export class InMemoryJobIdempotencyStore implements JobIdempotencyStore {
  private readonly processed = new Map<string, "success" | "failed">();

  private key(tenantId: string, jobType: string, idempotencyKey: string): string {
    return `${tenantId}:${jobType}:${idempotencyKey}`;
  }

  hasProcessed(tenantId: string, jobType: string, idempotencyKey: string): Promise<boolean> {
    return Promise.resolve(this.processed.has(this.key(tenantId, jobType, idempotencyKey)));
  }

  markProcessed(
    tenantId: string,
    jobType: string,
    idempotencyKey: string,
    result: "success" | "failed",
  ): Promise<void> {
    this.processed.set(this.key(tenantId, jobType, idempotencyKey), result);
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  backoffFactor: number;
}

export const DEFAULT_JOB_RETRY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  backoffFactor: 3,
};

// ---------------------------------------------------------------------------
// Job result
// ---------------------------------------------------------------------------

export interface JobResult<T = unknown> {
  success: boolean;
  skipped: boolean;
  data?: T | undefined;
  error?: string | undefined;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Job runner
// ---------------------------------------------------------------------------

export type JobHandler<P extends TenantJobPayload, T> = (
  executor: SqlExecutor,
  payload: P,
) => Promise<T>;

export async function runJob<P extends TenantJobPayload, T>(
  executor: SqlExecutor,
  payload: P,
  handler: JobHandler<P, T>,
  idempotency: JobIdempotencyStore,
  retry: RetryPolicy = DEFAULT_JOB_RETRY,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<JobResult<T>> {
  const partial = payload as Partial<TenantJobPayload>;
  assertTenantId(partial.tenantId);

  if (!partial.jobType || !partial.idempotencyKey) {
    return {
      success: false,
      skipped: false,
      error: "missing jobType or idempotencyKey",
      attempts: 0,
    };
  }

  // At-most-once check
  if (await idempotency.hasProcessed(payload.tenantId, payload.jobType, payload.idempotencyKey)) {
    return { success: true, skipped: true, attempts: 0 };
  }

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    try {
      const data = await withTenantContext(executor, payload.tenantId, (tx) =>
        handler(tx, payload),
      );
      await idempotency.markProcessed(
        payload.tenantId,
        payload.jobType,
        payload.idempotencyKey,
        "success",
      );
      return { success: true, skipped: false, data, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "unknown error";
    }

    if (attempt < retry.maxAttempts) {
      await sleep(retry.baseDelayMs * Math.pow(retry.backoffFactor, attempt - 1));
    }
  }

  await idempotency.markProcessed(
    payload.tenantId,
    payload.jobType,
    payload.idempotencyKey,
    "failed",
  );
  return { success: false, skipped: false, error: lastError, attempts: retry.maxAttempts };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
