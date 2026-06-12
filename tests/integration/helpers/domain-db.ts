/**
 * Fixture for persistence-adapter integration tests: applies the tenancy and
 * domain migrations, provisions the RLS-constrained app role with grants on
 * every domain table, and cleans rows from previous runs (scoped to the
 * fixture's slug prefix so other suites' data is untouched).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ADMIN_URL } from "./postgres.js";

const MIGRATIONS = ["001-tenancy.sql", "002-domain.sql"].map((file) =>
  fileURLToPath(new URL(`../../../infra/postgres/${file}`, import.meta.url)),
);

const APP_ROLE = "saas_app_test";
const APP_PASSWORD = "saas_app_test";

const DOMAIN_TABLES = [
  "categories",
  "services",
  "extras",
  "resources",
  "providers",
  "provider_schedules",
  "service_providers",
  "service_resources",
  "bookings",
  "cart_transactions",
  "sub_payments",
  "domain_events",
  "audit_records",
  "processed_webhooks",
  "provider_busy",
  "resource_allocations",
  "checkout_holds",
];

export interface DomainDbFixture {
  /** Connection string for the NOSUPERUSER/NOBYPASSRLS application role. */
  appUrl: string;
}

export async function setupDomainDb(slugPrefix: string): Promise<DomainDbFixture | null> {
  const admin = new pg.Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 3000 });
  try {
    await admin.connect();
  } catch {
    return null;
  }

  try {
    await admin.query("SELECT pg_advisory_lock(815001)");
    for (const migration of MIGRATIONS) {
      await admin.query(readFileSync(migration, "utf8"));
    }
    await admin.query(`
      DO $$ BEGIN
        CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
      GRANT USAGE ON SCHEMA public TO ${APP_ROLE};
      GRANT SELECT, INSERT, UPDATE ON tenants TO ${APP_ROLE};
      GRANT SELECT, INSERT, UPDATE ON tenant_domains TO ${APP_ROLE};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ${DOMAIN_TABLES.join(", ")} TO ${APP_ROLE};
    `);

    // Clean rows from previous runs of this fixture only.
    await admin.query(`TRUNCATE ${DOMAIN_TABLES.join(", ")}`);
    await admin.query(
      `DELETE FROM tenant_domains WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE $1)`,
      [`${slugPrefix}-%`],
    );
    await admin.query(`DELETE FROM tenants WHERE slug LIKE $1`, [`${slugPrefix}-%`]);

    const appUrl = new URL(ADMIN_URL);
    appUrl.username = APP_ROLE;
    appUrl.password = APP_PASSWORD;
    return { appUrl: appUrl.toString() };
  } finally {
    await admin.query("SELECT pg_advisory_unlock(815001)").catch(() => undefined);
    await admin.end();
  }
}
