/**
 * Drizzle adapter for the TenantRepository port and the tenant resolver's
 * TenantLookup. These are platform-global tables: hostname/slug resolution
 * happens before any tenant context exists, so no RLS applies here.
 */

import { eq } from "drizzle-orm";
import type { Tenant, TenantDomain } from "@saas-reservas/domain/tenancy/tenant";
import type { TenantDb } from "../db.js";
import { tenantDomains, tenants } from "../schema.js";

interface ResolvedTenant {
  tenantId: string;
  slug: string;
  status: "active" | "suspended" | "archived";
}

export class DrizzleTenantRepository {
  constructor(private readonly db: TenantDb) {}

  async insertTenant(tenant: Tenant): Promise<void> {
    await this.db.global((db) =>
      db.insert(tenants).values({
        id: tenant.id,
        slug: tenant.slug,
        displayName: tenant.displayName,
        status: tenant.status,
        defaultTimezone: tenant.defaultTimezone,
        defaultLocale: tenant.defaultLocale,
        currency: tenant.currency,
        branding: tenant.branding,
        policies: tenant.policies,
      }),
    );
  }

  async updateTenant(tenant: Tenant): Promise<void> {
    await this.db.global((db) =>
      db
        .update(tenants)
        .set({
          displayName: tenant.displayName,
          status: tenant.status,
          defaultTimezone: tenant.defaultTimezone,
          defaultLocale: tenant.defaultLocale,
          currency: tenant.currency,
          branding: tenant.branding,
          policies: tenant.policies,
        })
        .where(eq(tenants.id, tenant.id)),
    );
  }

  async findTenantById(tenantId: string): Promise<Tenant | null> {
    const rows = await this.db.global((db) =>
      db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1),
    );
    return rows[0] !== undefined ? toTenant(rows[0]) : null;
  }

  async findTenantBySlug(slug: string): Promise<Tenant | null> {
    const rows = await this.db.global((db) =>
      db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1),
    );
    return rows[0] !== undefined ? toTenant(rows[0]) : null;
  }

  async listTenants(): Promise<Tenant[]> {
    const rows = await this.db.global((db) => db.select().from(tenants));
    return rows.map(toTenant);
  }

  async insertDomain(domain: TenantDomain): Promise<void> {
    await this.db.global((db) => db.insert(tenantDomains).values(domain));
  }

  async findDomainByHostname(hostname: string): Promise<TenantDomain | null> {
    const rows = await this.db.global((db) =>
      db.select().from(tenantDomains).where(eq(tenantDomains.hostname, hostname)).limit(1),
    );
    return rows[0] ?? null;
  }

  /** Lookup adapter for the request tenant resolver. */
  tenantLookup(): {
    findById(tenantId: string): Promise<ResolvedTenant | null>;
    findBySubdomain(slug: string): Promise<ResolvedTenant | null>;
    findByCustomDomain(hostname: string): Promise<ResolvedTenant | null>;
  } {
    const toResolved = (tenant: Tenant): ResolvedTenant => ({
      tenantId: tenant.id,
      slug: tenant.slug,
      status: tenant.status,
    });
    return {
      findById: async (tenantId) => {
        const tenant = await this.findTenantById(tenantId);
        return tenant === null ? null : toResolved(tenant);
      },
      findBySubdomain: async (slug) => {
        const tenant = await this.findTenantBySlug(slug);
        return tenant === null ? null : toResolved(tenant);
      },
      findByCustomDomain: async (hostname) => {
        const domain = await this.findDomainByHostname(hostname);
        if (domain?.verificationStatus !== "verified") {
          return null;
        }
        const tenant = await this.findTenantById(domain.tenantId);
        return tenant === null ? null : toResolved(tenant);
      },
    };
  }
}

function toTenant(row: typeof tenants.$inferSelect): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    status: row.status,
    defaultTimezone: row.defaultTimezone,
    defaultLocale: row.defaultLocale,
    currency: row.currency,
    branding: row.branding,
    policies: row.policies,
  };
}
