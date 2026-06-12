import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolve workspace packages to TypeScript sources so tests run without a build step.
const src = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@saas-reservas/contracts/environment": src("packages/contracts/src/environment.ts"),
      "@saas-reservas/contracts/openapi": src("packages/contracts/src/openapi.ts"),
      "@saas-reservas/domain/audit/events": src("packages/domain/src/audit/events.ts"),
      "@saas-reservas/tenant-context/redis-keys": src("packages/tenant-context/src/redis-keys.ts"),
      "@saas-reservas/tenant-context/storage-paths": src(
        "packages/tenant-context/src/storage-paths.ts",
      ),
      "@saas-reservas/tenant-context": src("packages/tenant-context/src/tenant-context.ts"),
      "@saas-reservas/worker/jobs/run-tenant-job": src(
        "services/worker/src/jobs/run-tenant-job.ts",
      ),
    },
  },
  test: {
    setupFiles: ["./tests/setup.ts"],
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "packages/*/src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          // RLS, Redis locks, and queue tests hit real services from docker compose.
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "contract",
          include: ["tests/contract/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["tests/e2e/**/*.test.ts"],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
