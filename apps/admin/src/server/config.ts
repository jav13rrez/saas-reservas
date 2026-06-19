/**
 * Admin console data-mode configuration (ADR-0018).
 *
 * `ADMIN_DATA_MODE` selects where the console's server-side route handlers read
 * and write:
 *   - "demo" (default): the process-local in-memory demo store. No backend
 *     needed; the console runs with a single `pnpm dev`.
 *   - "api": the persistent Fastify API (PostgreSQL/RLS + staff auth). Requires
 *     the API origin, the tenant Host, and staff service-account credentials.
 *
 * All of this is server-only; none of it is exposed to the browser.
 */

export type DataMode = "demo" | "api";

export interface AdminApiConfig {
  /** Base origin of the persistent Fastify API, e.g. http://localhost:3001. */
  origin: string;
  /** Host header that resolves the tenant, e.g. mi-negocio.localhost. */
  tenantHost: string;
  /** Staff service-account email used to obtain an admin session. */
  staffEmail: string;
  /** Staff service-account password. */
  staffPassword: string;
}

export function dataMode(): DataMode {
  return process.env.ADMIN_DATA_MODE === "api" ? "api" : "demo";
}

/**
 * Resolve the API configuration for "api" mode. Throws a clear error when a
 * required variable is missing so misconfiguration fails fast instead of
 * silently falling back to the demo store.
 */
export function apiConfig(): AdminApiConfig {
  const origin = process.env.API_ORIGIN ?? "http://localhost:3001";
  const tenantHost = required("ADMIN_TENANT_HOST");
  const staffEmail = required("ADMIN_STAFF_EMAIL");
  const staffPassword = required("ADMIN_STAFF_PASSWORD");
  return { origin, tenantHost, staffEmail, staffPassword };
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `ADMIN_DATA_MODE=api requires ${name}. See docs/operations/SETUP.md and ADR-0018.`,
    );
  }
  return value;
}
