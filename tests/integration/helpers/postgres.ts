/**
 * Shared fixture for tenancy integration tests.
 *
 * Connects to the PostgreSQL instance from `infra/docker-compose.yml` (or
 * TEST_DATABASE_URL), applies the tenancy migration, creates a probe table
 * protected by `apply_tenant_rls`, and provisions a NOSUPERUSER/NOBYPASSRLS
 * application role so RLS is actually enforced for test queries.
 *
 * Returns null when no database is reachable so suites can self-skip.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const TENANCY_SQL_PATH = fileURLToPath(
  new URL("../../../infra/postgres/001-tenancy.sql", import.meta.url),
);

export const ADMIN_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://saas_admin:saas_admin@localhost:5432/saas_reservas";

const APP_ROLE = "saas_app_test";
const APP_PASSWORD = "saas_app_test";

export interface TenancyFixture {
  probeTable: string;
  tenantA: string;
  tenantB: string;
  connectAdmin(): Promise<pg.Client>;
  /** Connects with the RLS-constrained application role. */
  connectApp(): Promise<pg.Client>;
}

async function connect(connectionString: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3000 });
  await client.connect();
  return client;
}

async function upsertTenant(admin: pg.Client, slug: string): Promise<string> {
  const result = await admin.query<{ id: string }>(
    `INSERT INTO tenants (slug, display_name) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [slug, `Test tenant ${slug}`],
  );
  const id = result.rows[0]?.id;
  if (id === undefined) {
    throw new Error(`Failed to upsert tenant ${slug}`);
  }
  return id;
}

export async function setupTenancyFixture(
  probeTable: string,
  slugPrefix: string,
): Promise<TenancyFixture | null> {
  let admin: pg.Client;
  try {
    admin = await connect(ADMIN_URL);
  } catch {
    return null;
  }

  try {
    // Test files run in parallel against one database; serialize DDL setup.
    await admin.query("SELECT pg_advisory_lock(815001)");
    await admin.query(readFileSync(TENANCY_SQL_PATH, "utf8"));

    // probeTable comes from test code, never from input; identifier interpolation is safe here.
    await admin.query(`
      CREATE TABLE IF NOT EXISTS ${probeTable} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        note text NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${probeTable}_tenant ON ${probeTable} (tenant_id, note);
    `);
    await admin.query("SELECT apply_tenant_rls($1)", [probeTable]);

    await admin.query(`
      DO $$ BEGIN
        CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      GRANT USAGE ON SCHEMA public TO ${APP_ROLE};
      GRANT SELECT ON tenants TO ${APP_ROLE};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ${probeTable} TO ${APP_ROLE};
    `);

    const tenantA = await upsertTenant(admin, `${slugPrefix}-tenant-a`);
    const tenantB = await upsertTenant(admin, `${slugPrefix}-tenant-b`);

    // Superuser bypasses RLS, so seeding both tenants from the admin connection works.
    await admin.query(`TRUNCATE ${probeTable}`);
    await admin.query(
      `INSERT INTO ${probeTable} (tenant_id, note) VALUES ($1, 'seed-a'), ($2, 'seed-b')`,
      [tenantA, tenantB],
    );

    const appUrl = new URL(ADMIN_URL);
    appUrl.username = APP_ROLE;
    appUrl.password = APP_PASSWORD;

    return {
      probeTable,
      tenantA,
      tenantB,
      connectAdmin: () => connect(ADMIN_URL),
      connectApp: () => connect(appUrl.toString()),
    };
  } finally {
    await admin.query("SELECT pg_advisory_unlock(815001)").catch(() => undefined);
    await admin.end();
  }
}
