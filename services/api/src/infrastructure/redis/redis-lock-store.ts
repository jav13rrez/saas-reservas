/**
 * Redis-backed LockStore: SET NX PX for acquisition and a compare-and-delete
 * Lua script for ownership-safe release.
 */

import type { Redis } from "ioredis";
import type { LockStore } from "../../application/scheduling/checkout-lock-service.js";

const RELEASE_IF_OWNER_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class RedisLockStore implements LockStore {
  constructor(private readonly redis: Redis) {}

  async setIfAbsent(key: string, value: string, ttlMs: number): Promise<boolean> {
    const result = await this.redis.set(key, value, "PX", ttlMs, "NX");
    return result === "OK";
  }

  async releaseIfOwner(key: string, value: string): Promise<boolean> {
    const deleted = (await this.redis.eval(RELEASE_IF_OWNER_LUA, 1, key, value)) as number;
    return deleted === 1;
  }
}
