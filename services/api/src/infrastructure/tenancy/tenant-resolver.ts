/**
 * Request tenant resolution (plan.md "Routing And Branding").
 *
 * Tenants are resolved from, in order: subdomain of the platform base domain,
 * custom domain, or the authenticated session (on platform-owned hosts only).
 * Reverse-proxy header injection is only an optimization upstream — this resolver
 * re-validates against the tenant registry on every request, and an authenticated
 * session may never widen access to a different tenant than the host resolves to.
 */

import { isTenantId } from "@saas-reservas/tenant-context";

export interface ResolvedTenant {
  tenantId: string;
  slug: string;
  status: "active" | "suspended" | "archived";
}

/** Registry lookups, backed by the platform-global `tenants` table. */
export interface TenantLookup {
  findById(tenantId: string): Promise<ResolvedTenant | null>;
  findBySubdomain(slug: string): Promise<ResolvedTenant | null>;
  findByCustomDomain(host: string): Promise<ResolvedTenant | null>;
}

export type TenantSource = "subdomain" | "custom-domain" | "authenticated";

export type TenantResolution =
  | { ok: true; tenant: ResolvedTenant; source: TenantSource }
  | { ok: false; reason: "platform-host" | "unknown-host" | "invalid-host" | "invalid-session" }
  | { ok: false; reason: "tenant-inactive"; tenant: ResolvedTenant }
  | { ok: false; reason: "tenant-mismatch"; hostTenantId: string; sessionTenantId: string };

export interface ResolveRequestTenantInput {
  /** Raw Host (or validated X-Forwarded-Host) header value. */
  host: string | undefined;
  /** e.g. "reservas.example"; tenant slugs resolve as "{slug}.reservas.example". */
  platformBaseDomain: string;
  lookup: TenantLookup;
  /** Tenant id bound to the authenticated session, when any. */
  sessionTenantId?: string;
}

const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/** Lowercases and strips the port; returns null for syntactically invalid hosts. */
export function normalizeHost(rawHost: string | undefined): string | null {
  if (rawHost === undefined) {
    return null;
  }
  const host = rawHost.trim().toLowerCase().replace(/:\d+$/, "");
  return HOST_PATTERN.test(host) ? host : null;
}

function checkActive(tenant: ResolvedTenant, source: TenantSource): TenantResolution {
  if (tenant.status !== "active") {
    return { ok: false, reason: "tenant-inactive", tenant };
  }
  return { ok: true, tenant, source };
}

export async function resolveRequestTenant({
  host,
  platformBaseDomain,
  lookup,
  sessionTenantId,
}: ResolveRequestTenantInput): Promise<TenantResolution> {
  if (sessionTenantId !== undefined && !isTenantId(sessionTenantId)) {
    return { ok: false, reason: "invalid-session" };
  }

  const normalized = normalizeHost(host);
  if (normalized === null) {
    return { ok: false, reason: "invalid-host" };
  }

  const base = platformBaseDomain.toLowerCase();

  // Platform-owned hosts: only an authenticated session can scope a tenant.
  if (normalized === base || normalized === `www.${base}`) {
    if (sessionTenantId === undefined) {
      return { ok: false, reason: "platform-host" };
    }
    const tenant = await lookup.findById(sessionTenantId);
    if (tenant === null) {
      return { ok: false, reason: "invalid-session" };
    }
    return checkActive(tenant, "authenticated");
  }

  let tenant: ResolvedTenant | null;
  let source: TenantSource;
  if (normalized.endsWith(`.${base}`)) {
    const subdomain = normalized.slice(0, -(base.length + 1));
    if (subdomain.includes(".")) {
      // Nested subdomains are not tenant slugs.
      return { ok: false, reason: "unknown-host" };
    }
    tenant = await lookup.findBySubdomain(subdomain);
    source = "subdomain";
  } else {
    tenant = await lookup.findByCustomDomain(normalized);
    source = "custom-domain";
  }

  if (tenant === null) {
    return { ok: false, reason: "unknown-host" };
  }
  if (sessionTenantId !== undefined && sessionTenantId !== tenant.tenantId) {
    return {
      ok: false,
      reason: "tenant-mismatch",
      hostTenantId: tenant.tenantId,
      sessionTenantId,
    };
  }
  return checkActive(tenant, source);
}
