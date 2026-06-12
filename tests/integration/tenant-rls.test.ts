/**
 * T013: baseline proof that PostgreSQL RLS blocks cross-tenant reads and writes
 * for the application role, and fails closed when no tenant context is set.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { withTenantContext } from "@saas-reservas/tenant-context";
import { setupTenancyFixture, ADMIN_URL } from "./helpers/postgres.js";

const fixture = await setupTenancyFixture("rls_probe_t013", "t013");

if (fixture === null) {
  describe.skip(`RLS tenant isolation (PostgreSQL not reachable at ${ADMIN_URL})`, () => {
    it("skipped", () => undefined);
  });
} else {
  describe("RLS tenant isolation", () => {
    const { probeTable, tenantA, tenantB } = fixture;
    let app: pg.Client;

    beforeAll(async () => {
      app = await fixture.connectApp();
    });

    afterAll(async () => {
      await app.end();
    });

    it("returns no rows without tenant context (fail closed)", async () => {
      const result = await app.query(`SELECT * FROM ${probeTable}`);
      expect(result.rows).toHaveLength(0);
    });

    it("rejects writes without tenant context", async () => {
      await expect(
        app.query(`INSERT INTO ${probeTable} (tenant_id, note) VALUES ($1, 'no-context')`, [
          tenantA,
        ]),
      ).rejects.toThrow(/row-level security/);
    });

    it("scopes reads to the current tenant", async () => {
      const notesA = await withTenantContext(app, tenantA, async (tx) => {
        const result = (await tx.query(`SELECT note, tenant_id FROM ${probeTable}`)) as {
          rows: { note: string; tenant_id: string }[];
        };
        return result.rows;
      });
      expect(notesA).toHaveLength(1);
      expect(notesA[0]).toMatchObject({ note: "seed-a", tenant_id: tenantA });

      const notesB = await withTenantContext(app, tenantB, async (tx) => {
        const result = (await tx.query(`SELECT note FROM ${probeTable}`)) as {
          rows: { note: string }[];
        };
        return result.rows;
      });
      expect(notesB).toHaveLength(1);
      expect(notesB[0]?.note).toBe("seed-b");
    });

    it("allows writes for the current tenant only", async () => {
      await withTenantContext(app, tenantA, async (tx) => {
        await tx.query(`INSERT INTO ${probeTable} (tenant_id, note) VALUES ($1, 'own-write')`, [
          tenantA,
        ]);
      });

      // Writing a row that claims another tenant's id violates WITH CHECK.
      await expect(
        withTenantContext(app, tenantA, async (tx) => {
          await tx.query(`INSERT INTO ${probeTable} (tenant_id, note) VALUES ($1, 'spoofed')`, [
            tenantB,
          ]);
        }),
      ).rejects.toThrow(/row-level security/);
    });

    it("makes cross-tenant updates and deletes no-ops", async () => {
      const { updated, deleted } = await withTenantContext(app, tenantB, async (tx) => {
        const updateResult = (await tx.query(
          `UPDATE ${probeTable} SET note = 'tampered' WHERE tenant_id = $1`,
          [tenantA],
        )) as { rowCount: number | null };
        const deleteResult = (await tx.query(
          `DELETE FROM ${probeTable} WHERE note = 'seed-a'`,
        )) as {
          rowCount: number | null;
        };
        return { updated: updateResult.rowCount, deleted: deleteResult.rowCount };
      });
      expect(updated).toBe(0);
      expect(deleted).toBe(0);

      // Tenant A's data is intact.
      const intact = await withTenantContext(app, tenantA, async (tx) => {
        const result = (await tx.query(
          `SELECT count(*)::int AS count FROM ${probeTable} WHERE note = 'seed-a'`,
        )) as { rows: { count: number }[] };
        return result.rows[0]?.count;
      });
      expect(intact).toBe(1);
    });
  });
}
