/**
 * T080 – Job runner: idempotency, retry policy, tenant context binding.
 */

import { describe, it, expect, vi } from "vitest";
import {
  runJob,
  InMemoryJobIdempotencyStore,
  DEFAULT_JOB_RETRY,
  type TenantJobPayload,
  type RetryPolicy,
} from "@saas-reservas/worker/infrastructure/jobs/job-runner";
import type { SqlExecutor } from "@saas-reservas/tenant-context";

const noSleep = (_ms: number) => Promise.resolve();
const VALID_TENANT_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const fakeSql: SqlExecutor = {
  query: (_sql: string, _params?: unknown[]) => Promise.resolve({ rows: [] }),
};

function makePayload(overrides: Partial<TenantJobPayload> = {}): TenantJobPayload {
  return {
    tenantId: VALID_TENANT_UUID,
    jobType: "test.job",
    idempotencyKey: "key-1",
    enqueuedAt: "2026-06-15T00:00:00Z",
    ...overrides,
  };
}

describe("runJob", () => {
  describe("validation", () => {
    it("throws when tenantId is not a UUID", async () => {
      const store = new InMemoryJobIdempotencyStore();
      const payload = makePayload({ tenantId: "not-a-uuid" });
      await expect(
        runJob(fakeSql, payload, () => Promise.resolve("ok"), store, DEFAULT_JOB_RETRY, noSleep),
      ).rejects.toThrow("Invalid tenant id");
    });

    it("returns failure when jobType is missing", async () => {
      const store = new InMemoryJobIdempotencyStore();
      // @ts-expect-error — intentional bad payload
      const payload = makePayload({ jobType: "" });
      const result = await runJob(
        fakeSql,
        payload,
        () => Promise.resolve("ok"),
        store,
        DEFAULT_JOB_RETRY,
        noSleep,
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/jobType/);
    });

    it("returns failure when idempotencyKey is missing", async () => {
      const store = new InMemoryJobIdempotencyStore();
      // @ts-expect-error — intentional bad payload
      const payload = makePayload({ idempotencyKey: "" });
      const result = await runJob(
        fakeSql,
        payload,
        () => Promise.resolve("ok"),
        store,
        DEFAULT_JOB_RETRY,
        noSleep,
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/idempotencyKey/);
    });
  });

  describe("idempotency", () => {
    it("skips job already marked as processed", async () => {
      const store = new InMemoryJobIdempotencyStore();
      const payload = makePayload();
      await store.markProcessed(
        payload.tenantId,
        payload.jobType,
        payload.idempotencyKey,
        "success",
      );
      const handler = vi.fn().mockResolvedValue("result");
      const result = await runJob(fakeSql, payload, handler, store, DEFAULT_JOB_RETRY, noSleep);
      expect(result.skipped).toBe(true);
      expect(result.success).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    });

    it("marks job as processed after success", async () => {
      const store = new InMemoryJobIdempotencyStore();
      const payload = makePayload();
      await runJob(
        fakeSql,
        payload,
        () => Promise.resolve("data"),
        store,
        DEFAULT_JOB_RETRY,
        noSleep,
      );
      expect(
        await store.hasProcessed(payload.tenantId, payload.jobType, payload.idempotencyKey),
      ).toBe(true);
    });

    it("marks job as failed after all attempts exhausted", async () => {
      const store = new InMemoryJobIdempotencyStore();
      const payload = makePayload();
      const policy: RetryPolicy = { maxAttempts: 1, baseDelayMs: 0, backoffFactor: 1 };
      await runJob(
        fakeSql,
        payload,
        () => Promise.reject(new Error("boom")),
        store,
        policy,
        noSleep,
      );
      expect(
        await store.hasProcessed(payload.tenantId, payload.jobType, payload.idempotencyKey),
      ).toBe(true);
    });
  });

  describe("success path", () => {
    it("returns data from handler on first attempt", async () => {
      const store = new InMemoryJobIdempotencyStore();
      const result = await runJob(
        fakeSql,
        makePayload(),
        () => Promise.resolve({ processed: true }),
        store,
        DEFAULT_JOB_RETRY,
        noSleep,
      );
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.data).toEqual({ processed: true });
      expect(result.attempts).toBe(1);
    });
  });

  describe("retry behaviour", () => {
    it("retries on transient failure and succeeds on second attempt", async () => {
      const store = new InMemoryJobIdempotencyStore();
      let calls = 0;
      const handler = () => {
        calls++;
        if (calls < 2) return Promise.reject(new Error("transient"));
        return Promise.resolve("recovered");
      };
      const policy: RetryPolicy = { maxAttempts: 3, baseDelayMs: 10, backoffFactor: 2 };
      const result = await runJob(fakeSql, makePayload(), handler, store, policy, noSleep);
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it("returns failure after exhausting all attempts", async () => {
      const store = new InMemoryJobIdempotencyStore();
      const policy: RetryPolicy = { maxAttempts: 3, baseDelayMs: 0, backoffFactor: 1 };
      const result = await runJob(
        fakeSql,
        makePayload(),
        () => Promise.reject(new Error("permanent")),
        store,
        policy,
        noSleep,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("permanent");
      expect(result.attempts).toBe(3);
    });

    it("sleeps between attempts with exponential back-off", async () => {
      const store = new InMemoryJobIdempotencyStore();
      const sleeps: number[] = [];
      const fakeSleepFn = (ms: number) => {
        sleeps.push(ms);
        return Promise.resolve();
      };
      const policy: RetryPolicy = { maxAttempts: 3, baseDelayMs: 100, backoffFactor: 3 };
      await runJob(
        fakeSql,
        makePayload(),
        () => Promise.reject(new Error("fail")),
        store,
        policy,
        fakeSleepFn,
      );
      expect(sleeps).toEqual([100, 300]); // attempts 1→2 and 2→3; no sleep after last
    });
  });

  describe("InMemoryJobIdempotencyStore", () => {
    it("returns false for unseen keys", async () => {
      const store = new InMemoryJobIdempotencyStore();
      expect(await store.hasProcessed("t1", "job", "key")).toBe(false);
    });

    it("returns true after marking", async () => {
      const store = new InMemoryJobIdempotencyStore();
      await store.markProcessed("t1", "job", "key", "success");
      expect(await store.hasProcessed("t1", "job", "key")).toBe(true);
    });

    it("isolates by tenantId", async () => {
      const store = new InMemoryJobIdempotencyStore();
      await store.markProcessed("t1", "job", "key", "success");
      expect(await store.hasProcessed("t2", "job", "key")).toBe(false);
    });
  });
});
