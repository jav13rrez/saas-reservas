/**
 * Tenant administration application service (T022): tenant setup, domain
 * configuration, branding, and policy management. Validation lives in the
 * domain; persistence and event recording are injected ports.
 */

import { randomUUID } from "node:crypto";
import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import {
  DEFAULT_BRANDING,
  DEFAULT_POLICIES,
  validateTenant,
  type Tenant,
  type TenantBranding,
  type TenantDomain,
  type TenantDomainKind,
  type TenantPolicies,
} from "@saas-reservas/domain/tenancy/tenant";
import type { EventSink } from "../events.js";

export interface TenantRepository {
  insertTenant(tenant: Tenant): Promise<void>;
  updateTenant(tenant: Tenant): Promise<void>;
  findTenantById(tenantId: string): Promise<Tenant | null>;
  findTenantBySlug(slug: string): Promise<Tenant | null>;
  listTenants(): Promise<Tenant[]>;
  insertDomain(domain: TenantDomain): Promise<void>;
  findDomainByHostname(hostname: string): Promise<TenantDomain | null>;
}

export class TenantAdminError extends Error {
  constructor(
    message: string,
    readonly code: "slug-taken" | "hostname-taken" | "tenant-not-found",
  ) {
    super(message);
    this.name = "TenantAdminError";
  }
}

export interface UpdateTenantStatusInput {
  tenantId: string;
  status: "active" | "suspended";
  actor: Actor;
}

export interface CreateTenantInput {
  slug: string;
  displayName: string;
  defaultTimezone: string;
  defaultLocale?: string;
  branding?: Partial<TenantBranding>;
  policies?: Partial<TenantPolicies>;
  actor: Actor;
}

export class TenantAdminService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly events: EventSink,
  ) {}

  async listTenants(): Promise<Tenant[]> {
    return this.tenants.listTenants();
  }

  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    const tenant: Tenant = {
      id: randomUUID(),
      slug: input.slug,
      displayName: input.displayName,
      status: "active",
      defaultTimezone: input.defaultTimezone,
      defaultLocale: input.defaultLocale ?? "es-ES",
      branding: { ...DEFAULT_BRANDING, ...input.branding },
      policies: { ...DEFAULT_POLICIES, ...input.policies },
    };
    validateTenant(tenant);
    if ((await this.tenants.findTenantBySlug(tenant.slug)) !== null) {
      throw new TenantAdminError(`slug ${tenant.slug} is already taken`, "slug-taken");
    }
    await this.tenants.insertTenant(tenant);
    await this.recordAudit(tenant.id, input.actor, "tenant.created", "tenant", tenant.id, {
      slug: tenant.slug,
    });
    return tenant;
  }

  async addDomain(input: {
    tenantId: string;
    hostname: string;
    kind: TenantDomainKind;
    actor: Actor;
  }): Promise<TenantDomain> {
    await this.requireTenant(input.tenantId);
    const hostname = input.hostname.toLowerCase();
    if ((await this.tenants.findDomainByHostname(hostname)) !== null) {
      throw new TenantAdminError(`hostname ${hostname} is already taken`, "hostname-taken");
    }
    const domain: TenantDomain = {
      id: randomUUID(),
      tenantId: input.tenantId,
      hostname,
      kind: input.kind,
      // Platform subdomains are ours; custom domains need DNS verification first.
      verificationStatus: input.kind === "subdomain" ? "verified" : "pending",
    };
    await this.tenants.insertDomain(domain);
    await this.recordAudit(
      input.tenantId,
      input.actor,
      "tenant.domain-added",
      "tenant-domain",
      domain.id,
      {
        hostname,
        kind: input.kind,
      },
    );
    return domain;
  }

  async updateBranding(input: {
    tenantId: string;
    branding: Partial<TenantBranding>;
    actor: Actor;
  }): Promise<Tenant> {
    const tenant = await this.requireTenant(input.tenantId);
    const updated: Tenant = { ...tenant, branding: { ...tenant.branding, ...input.branding } };
    validateTenant(updated);
    await this.tenants.updateTenant(updated);
    await this.recordAudit(tenant.id, input.actor, "tenant.branding-updated", "tenant", tenant.id);
    return updated;
  }

  async updateStatus(input: UpdateTenantStatusInput): Promise<Tenant> {
    const tenant = await this.requireTenant(input.tenantId);
    const updated: Tenant = { ...tenant, status: input.status };
    await this.tenants.updateTenant(updated);
    const action = input.status === "suspended" ? "tenant.suspended" : "tenant.reactivated";
    await this.recordAudit(tenant.id, input.actor, action, "tenant", tenant.id, {
      status: input.status,
    });
    return updated;
  }

  async updatePolicies(input: {
    tenantId: string;
    policies: Partial<TenantPolicies>;
    actor: Actor;
  }): Promise<Tenant> {
    const tenant = await this.requireTenant(input.tenantId);
    const updated: Tenant = { ...tenant, policies: { ...tenant.policies, ...input.policies } };
    validateTenant(updated);
    await this.tenants.updateTenant(updated);
    await this.recordAudit(tenant.id, input.actor, "tenant.policies-updated", "tenant", tenant.id);
    return updated;
  }

  private async requireTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenants.findTenantById(tenantId);
    if (tenant === null) {
      throw new TenantAdminError(`tenant ${tenantId} not found`, "tenant-not-found");
    }
    return tenant;
  }

  private async recordAudit(
    tenantId: string,
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const event = createDomainEvent({ tenantId, type: action, actor, payload: { entityId } });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action,
        entityType,
        entityId,
        ...(metadata ? { metadata } : {}),
      }),
    );
  }
}
