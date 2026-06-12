/**
 * T014: baseline proof that worker jobs bind tenant context before any
 * tenant-owned database access, and reject payloads without a valid tenant id
 * before touching the database at all.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import {
  getTenantContext,
  InvalidTenantIdError,
  type SqlExecutor,
} from "@saas-reservas/tenant-context";
import { runTenantJob } from "@saas-reservas/worker/jobs/run-tenant-job";
import { setupTenancyFixture, ADMIN_URL } from "./helpers/postgres.js";

const fixture = await setupTenancyFixture("rls_probe_t014", "t014");

/** Wraps an executor and counts every statement that reaches the database. */
function countingExecutor(inner: SqlExecutor): { executor: SqlExecutor; count(): number } {
  let queries = 0;
  return {
    executor: {
      query(sql, params) {
        queries += 1;
        return inner.query(sql, params);
      },
    },
    count: () => queries,
  };
}

if (fixture === null) {
  describe.skip(`Worker tenant context (PostgreSQL not reachable at ${ADMIN_URL})`, () => {
    it("skipped", () => undefined);
  });
} else {
  describe("Worker tenant context", () => {
    const { probeTable, tenantA, tenantB } = fixture;
    let app: pg.Client;

    beforeAll(async () => {
      app = await fixture.connectApp();
    });

    afterAll(async () => {
      await app.end();
    });

    it("rejects payloads without a valid tenant id before any query runs", async () => {
      const counting = countingExecutor(app);

      await expect(
        runTenantJob(counting.executor, { tenantId: "not-a-uuid" }, () =>
          Promise.resolve(undefined),
        ),
      ).rejects.toThrow(InvalidTenantIdError);

      await expect(
        runTenantJob(counting.executor, { tenantId: undefined as unknown as string }, () =>
          Promise.resolve(undefined),
        ),
      ).rejects.toThrow(InvalidTenantIdError);

      expect(counting.count()).toBe(0);
    });

    it("binds tenant context before the handler executes", async () => {
      const contextSeenByHandler = await runTenantJob(app, { tenantId: tenantA }, (tx) =>
        getTenantContext(tx),
      );
      expect(contextSeenByHandler).toBe(tenantA);
    });

    it("lets handlers see only their tenant's rows", async () => {
      const notes = await runTenantJob(app, { tenantId: tenantA }, async (tx) => {
        const result = (await tx.query(`SELECT note FROM ${probeTable} ORDER BY note`)) as {
          rows: { note: string }[];
        };
        return result.rows.map((row) => row.note);
      });
      expect(notes).toEqual(["seed-a"]);

      const crossTenantRows = await runTenantJob(app, { tenantId: tenantB }, async (tx) => {
        const result = (await tx.query(`SELECT note FROM ${probeTable} WHERE tenant_id = $1`, [
          tenantA,
        ])) as { rows: unknown[] };
        return result.rows;
      });
      expect(crossTenantRows).toHaveLength(0);
    });

    it("rolls back the job transaction when the handler fails", async () => {
      await expect(
        runTenantJob(app, { tenantId: tenantA }, async (tx) => {
          await tx.query(`INSERT INTO ${probeTable} (tenant_id, note) VALUES ($1, 'doomed')`, [
            tenantA,
          ]);
          throw new Error("job failed after write");
        }),
      ).rejects.toThrow("job failed after write");

      const remaining = await runTenantJob(app, { tenantId: tenantA }, async (tx) => {
        const result = (await tx.query(
          `SELECT count(*)::int AS count FROM ${probeTable} WHERE note = 'doomed'`,
        )) as { rows: { count: number }[] };
        return result.rows[0]?.count;
      });
      expect(remaining).toBe(0);
    });
  });
}
