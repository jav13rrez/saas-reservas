/**
 * Checkout slot lock service (T034).
 *
 * Acquires a provisional hold on a provider/resource/time slot before payment
 * (plan.md: key `lock:{tenant_id}:{provider_id}:{resource_id}:{start_at}`,
 * default TTL 10 minutes). Ownership tokens make release safe: a lock can only
 * be released by the checkout that acquired it, and TTL expiry frees the slot
 * automatically when payment never completes (spec US2 scenario 3).
 */

import { randomUUID } from "node:crypto";
import { DEFAULT_LOCK_TTL_SECONDS, slotLockKey } from "@saas-reservas/tenant-context/redis-keys";

/** Minimal atomic store; implemented by Redis (production) and memory (tests/dev). */
export interface LockStore {
  /** Sets key=value with TTL only if absent; true when the lock was acquired. */
  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** Deletes the key only if it still holds `value`; true when released. */
  releaseIfOwner(key: string, value: string): Promise<boolean>;
}

export interface SlotRef {
  tenantId: string;
  providerId: string;
  /** "none" when the slot consumes no shared resource. */
  resourceId: string;
  startAt: Date;
}

export type AcquireResult =
  | { acquired: true; key: string; token: string; expiresAt: Date }
  | { acquired: false; key: string };

export class CheckoutLockService {
  constructor(
    private readonly store: LockStore,
    private readonly defaultTtlSeconds: number = DEFAULT_LOCK_TTL_SECONDS,
  ) {}

  async acquire(slot: SlotRef, ttlSeconds?: number): Promise<AcquireResult> {
    const key = slotLockKey(slot);
    const token = randomUUID();
    const ttlMs = (ttlSeconds ?? this.defaultTtlSeconds) * 1000;
    const acquired = await this.store.setIfAbsent(key, token, ttlMs);
    return acquired
      ? { acquired: true, key, token, expiresAt: new Date(Date.now() + ttlMs) }
      : { acquired: false, key };
  }

  /** True when this checkout still owned the lock and it was freed. */
  async release(slot: SlotRef, token: string): Promise<boolean> {
    return this.store.releaseIfOwner(slotLockKey(slot), token);
  }
}
