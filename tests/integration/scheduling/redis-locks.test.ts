/**
 * T029: Redis checkout lock concurrency — acquisition, rejection of competing
 * checkouts, TTL expiration freeing the slot, and ownership-safe release.
 * Runs against real Redis; self-skips when none is reachable.
 */

import { afterAll, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import {
  CheckoutLockService,
  type SlotRef,
} from "@saas-reservas/api/application/scheduling/checkout-lock-service";
import { RedisLockStore } from "@saas-reservas/api/infrastructure/redis/redis-lock-store";

const REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6379";

async function tryConnect(): Promise<Redis | null> {
  const redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  try {
    await redis.connect();
    await redis.ping();
    return redis;
  } catch {
    redis.disconnect();
    return null;
  }
}

const redis = await tryConnect();

const slot: SlotRef = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  providerId: "prov-1",
  resourceId: "room-1",
  startAt: new Date("2026-06-15T09:00:00Z"),
};

if (redis === null) {
  describe.skip(`Redis checkout locks (Redis not reachable at ${REDIS_URL})`, () => {
    it("skipped", () => undefined);
  });
} else {
  describe("Redis checkout locks", () => {
    const locks = new CheckoutLockService(new RedisLockStore(redis));

    afterAll(async () => {
      await redis.quit();
    });

    it("grants the lock to exactly one of two concurrent checkouts", async () => {
      const [first, second] = await Promise.all([locks.acquire(slot, 5), locks.acquire(slot, 5)]);
      const granted = [first, second].filter((result) => result.acquired);
      expect(granted).toHaveLength(1);
      const winner = granted[0];
      if (!winner?.acquired) {
        throw new Error("expected a winner");
      }
      expect(winner.key).toBe(`lock:${slot.tenantId}:prov-1:room-1:2026-06-15T09:00:00.000Z`);
      expect(await locks.release(slot, winner.token)).toBe(true);
    });

    it("frees the slot when the TTL expires without payment", async () => {
      const hold = await locks.acquire(slot, 1); // 1 second TTL
      expect(hold.acquired).toBe(true);
      expect((await locks.acquire(slot, 1)).acquired).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const retry = await locks.acquire(slot, 5);
      expect(retry.acquired).toBe(true);
      if (retry.acquired) {
        await locks.release(slot, retry.token);
      }
    });

    it("only the owner token can release; stale releases never free a new hold", async () => {
      const first = await locks.acquire(slot, 5);
      if (!first.acquired) {
        throw new Error("expected acquisition");
      }
      expect(await locks.release(slot, first.token)).toBe(true);
      // Slot is re-acquired by another checkout; the old token must be useless.
      const second = await locks.acquire(slot, 5);
      if (!second.acquired) {
        throw new Error("expected acquisition");
      }
      expect(await locks.release(slot, first.token)).toBe(false);
      expect((await locks.acquire(slot, 5)).acquired).toBe(false); // still held
      expect(await locks.release(slot, second.token)).toBe(true);
    });

    it("scopes locks by tenant: same slot in another tenant is independent", async () => {
      const otherTenant: SlotRef = { ...slot, tenantId: "00000000-0000-4000-8000-000000000002" };
      const a = await locks.acquire(slot, 5);
      const b = await locks.acquire(otherTenant, 5);
      expect(a.acquired).toBe(true);
      expect(b.acquired).toBe(true);
      if (a.acquired) {
        await locks.release(slot, a.token);
      }
      if (b.acquired) {
        await locks.release(otherTenant, b.token);
      }
    });
  });
}
