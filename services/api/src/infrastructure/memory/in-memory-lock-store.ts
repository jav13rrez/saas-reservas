/**
 * In-memory LockStore with real TTL semantics, for tests and local dev.
 */

import type { LockStore } from "../../application/scheduling/checkout-lock-service.js";

interface Entry {
  value: string;
  expiresAtMs: number;
}

export class InMemoryLockStore implements LockStore {
  private readonly entries = new Map<string, Entry>();

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry !== undefined && entry.expiresAtMs <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean> {
    if (this.live(key) !== undefined) {
      return Promise.resolve(false);
    }
    this.entries.set(key, { value, expiresAtMs: Date.now() + ttlMs });
    return Promise.resolve(true);
  }

  releaseIfOwner(key: string, value: string): Promise<boolean> {
    const entry = this.live(key);
    if (entry?.value !== value) {
      return Promise.resolve(false);
    }
    this.entries.delete(key);
    return Promise.resolve(true);
  }
}
