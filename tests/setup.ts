// Global test setup shared by all vitest projects (unit, integration, contract, e2e).
//
// Tests must never run against production-like configuration, and tenant-scoped
// integration tests rely on deterministic time zone behavior.
process.env.NODE_ENV = "test";
process.env.TZ ??= "UTC";
