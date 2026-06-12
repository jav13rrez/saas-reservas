/**
 * Database access with RLS tenant context.
 *
 * Every tenant-scoped repository call runs inside `withTenant`, which opens a
 * transaction and binds `app.current_tenant_id` before any statement executes
 * (constitution principle I). Platform-global tables (tenants registry,
 * tenant_domains) use `global` instead. The pool must connect with a
 * NOSUPERUSER/NOBYPASSRLS role in every non-test environment.
 */

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import { assertTenantId } from "@saas-reservas/tenant-context";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export class TenantDb {
  readonly db: Db;

  constructor(private readonly pool: pg.Pool) {
    this.db = drizzle(pool, { schema });
  }

  /** Runs `fn` in a transaction with tenant context bound first. */
  async withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    assertTenantId(tenantId);
    return this.db.transaction(async (tx) => {
      // set_config(..., true) is transaction-local; parameterized SET LOCAL.
      await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
      return fn(tx);
    });
  }

  /** Platform-global access (tenants registry, domains); no tenant context. */
  async global<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    return fn(this.db);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createTenantDb(connectionString: string): TenantDb {
  return new TenantDb(new pg.Pool({ connectionString }));
}
