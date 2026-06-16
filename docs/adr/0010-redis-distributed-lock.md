# ADR-0010: Redis SET NX PX for Distributed Availability Locks

**Status:** Accepted  
**Date:** 2026-06-15  
**Tasks:** T045, T083

## Context

Concurrent booking attempts for the same provider time slot can produce double-bookings if two requests pass the availability check simultaneously before either commits. A database-level advisory lock is an option, but it ties lock duration to the Postgres connection and can block the connection pool under load.

## Decision

Use Redis `SET key value NX PX ttl` (SET if Not eXists, with millisecond TTL) as a short-lived distributed lock during the booking confirmation window:

- Key: `lock:booking:{tenantId}:{providerId}:{slotStartIso}`
- TTL: 10 seconds (far exceeds the expected booking transaction duration of < 500 ms)
- Value: a random UUID (the acquiring request's correlation ID) to enable safe unlock via `GET + DEL` with Lua compare-and-swap

If the lock cannot be acquired, the request is rejected with `409 Conflict` and the client is instructed to retry.

Lock release uses a Lua script to avoid race conditions between GET and DEL:

```lua
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
```

## Consequences

- Double-bookings are prevented across API replicas.
- Redis becomes a soft dependency; if Redis is unavailable, booking creation falls back to a Postgres advisory lock (`pg_try_advisory_xact_lock`) to maintain availability at reduced concurrency safety.
- Lock TTL must be tuned relative to the slowest expected payment capture round-trip (Stripe < 3 s), so 10 s provides adequate headroom.
- This is not Redlock (multi-node quorum). For the current single-Redis-node deployment, `SET NX PX` is sufficient. If Redis is promoted to a cluster, revisit with Redlock.
