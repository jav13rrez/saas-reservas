/**
 * Admin settings routes (feature 003, tenant-settings): GET/PATCH
 * /v1/admin/settings over the request-resolved tenant. No tenantId path param —
 * isolation is structural (the tenant is resolved from the request, ADR-0018).
 * These sit under the existing /v1/admin/* staff-auth gate, which already
 * requires an admin-role session; in tests without staffAuth they stay open.
 *
 * Validation lives in the domain (`validateTenant`); InvalidTenantError carries a
 * stable code mapped 1:1 to the contract's 400 error codes.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Actor } from "@saas-reservas/domain/audit/events";
import { InvalidTenantError, type TenantBranding } from "@saas-reservas/domain/tenancy/tenant";
import type {
  TenantAdminService,
  UpdateSettingsInput,
} from "../application/tenancy/tenant-admin-service.js";

interface SettingsRouteDeps {
  tenantAdmin: TenantAdminService;
  tenantOf(request: FastifyRequest): { tenantId: string; slug: string };
  adminActor(request: FastifyRequest): Actor;
}

interface PatchBody {
  profile?: { displayName?: unknown };
  localization?: { defaultTimezone?: unknown; defaultLocale?: unknown; currency?: unknown };
  policies?: {
    cancellationMinNoticeHours?: unknown;
    rescheduleMinNoticeHours?: unknown;
    bookingHorizonDays?: unknown;
    requiresApproval?: unknown;
  };
  branding?: { primaryColor?: unknown; logoUrl?: unknown };
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

function pickDefined<T extends Record<string, unknown>>(obj: T): Defined<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Defined<T>;
}

export function registerAdminSettingsRoutes(app: FastifyInstance, deps: SettingsRouteDeps): void {
  app.get("/v1/admin/settings", async (request, reply) => {
    const { tenantId } = deps.tenantOf(request);
    const settings = await deps.tenantAdmin.getSettings(tenantId);
    return reply.send(settings);
  });

  app.patch("/v1/admin/settings", async (request, reply) => {
    const { tenantId } = deps.tenantOf(request);
    const body = (request.body ?? {}) as PatchBody;

    const input: UpdateSettingsInput = { tenantId, actor: deps.adminActor(request) };

    if (body.profile !== undefined) {
      input.profile = pickDefined({ displayName: str(body.profile.displayName) });
    }
    if (body.localization !== undefined) {
      input.localization = pickDefined({
        defaultTimezone: str(body.localization.defaultTimezone),
        defaultLocale: str(body.localization.defaultLocale),
        currency: str(body.localization.currency),
      });
    }
    if (body.policies !== undefined) {
      input.policies = pickDefined({
        cancellationMinNoticeHours: num(body.policies.cancellationMinNoticeHours),
        rescheduleMinNoticeHours: num(body.policies.rescheduleMinNoticeHours),
        bookingHorizonDays: num(body.policies.bookingHorizonDays),
        requiresApproval: bool(body.policies.requiresApproval),
      });
    }
    if (body.branding !== undefined) {
      const branding: Partial<TenantBranding> = pickDefined({
        primaryColor: str(body.branding.primaryColor),
      });
      // logoUrl is clearable: an explicit empty string means "no logo".
      if ("logoUrl" in body.branding) {
        branding.logoUrl = str(body.branding.logoUrl) ?? "";
      }
      input.branding = branding;
    }

    try {
      const settings = await deps.tenantAdmin.updateSettings(input);
      return await reply.send(settings);
    } catch (error) {
      if (error instanceof InvalidTenantError) {
        return reply.code(400).send({ error: error.code });
      }
      throw error;
    }
  });
}
