import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolve workspace packages to TypeScript sources so tests run without a build step.
const src = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@saas-reservas\/contracts\/(.*)$/,
        replacement: src("packages/contracts/src/") + "$1.ts",
      },
      {
        find: /^@saas-reservas\/domain\/(.*)$/,
        replacement: src("packages/domain/src/") + "$1.ts",
      },
      {
        find: /^@saas-reservas\/tenant-context\/(.*)$/,
        replacement: src("packages/tenant-context/src/") + "$1.ts",
      },
      {
        find: "@saas-reservas/tenant-context",
        replacement: src("packages/tenant-context/src/tenant-context.ts"),
      },
      {
        find: /^@saas-reservas\/worker\/(.*)$/,
        replacement: src("services/worker/src/") + "$1.ts",
      },
      { find: /^@saas-reservas\/api\/(.*)$/, replacement: src("services/api/src/") + "$1.ts" },
    ],
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
