/**
 * Public availability API and admin catalog API (T025).
 *
 * Every tenant-scoped route resolves the tenant from the Host header on each
 * request (constitution: proxy header injection is only an optimization).
 * NOTE: staff authentication for /v1/admin/* arrives with the identity tasks;
 * until then these routes must only be exposed in development environments.
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { SYSTEM_ACTOR, type Actor } from "@saas-reservas/domain/audit/events";
import type { ProviderScheduleEntry } from "@saas-reservas/domain/providers/provider";
import type { CatalogService } from "../application/catalog/catalog-service.js";
import type { ResourceHubService } from "../application/catalog/resource-hub-service.js";
import type { AvailabilityService } from "../application/scheduling/availability-service.js";
import type { TenantAdminService } from "../application/tenancy/tenant-admin-service.js";
import {
  resolveRequestTenant,
  type TenantLookup,
  type TenantResolution,
} from "../infrastructure/tenancy/tenant-resolver.js";
import { registerCheckoutRoutes, type CheckoutDeps } from "./checkout-routes.js";
import { registerEventRoutes, type EventDeps } from "./event-routes.js";
import { registerPortalRoutes, type PortalDeps } from "./portal-routes.js";
import {
  registerCalendarWebhookRoutes,
  type CalendarWebhookDeps,
} from "./calendar-webhook-routes.js";

export interface AppDeps {
  platformBaseDomain: string;
  tenantLookup: TenantLookup;
  tenantAdmin: TenantAdminService;
  catalogService: CatalogService;
  /** Resource hub configuration (ADR-0016); omit to disable the hub admin routes. */
  resourceHub?: ResourceHubService;
  availability: AvailabilityService;
  /** Tenant default timezone lookup for availability queries. */
  tenantTimezone(tenantId: string): Promise<string>;
  /** Checkout/payment wiring (US2); omit to expose catalog/availability only. */
  checkout?: Omit<CheckoutDeps, "availability" | "tenantTimezone">;
  /** Customer/staff portal wiring (US3). */
  portal?: PortalDeps;
  /** Events/tickets/waitlist wiring (US4). */
  events?: EventDeps;
  /** External calendar webhook receiver (US5); omit to disable the routes. */
  calendarWebhooks?: CalendarWebhookDeps;
}

interface RequestTenant {
  tenantId: string;
  slug: string;
}

declare module "fastify" {
  interface FastifyRequest {
    tenant?: RequestTenant;
  }
}

function failureStatus(resolution: Exclude<TenantResolution, { ok: true }>): number {
  switch (resolution.reason) {
    case "tenant-mismatch":
      return 403;
    case "tenant-inactive":
      return 403;
    case "invalid-session":
      return 401;
    case "platform-host":
    case "unknown-host":
    case "invalid-host":
      return 404;
  }
}

const ADMIN_ACTOR: Actor = SYSTEM_ACTOR; // placeholder until staff auth lands

function tenantOf(request: FastifyRequest): RequestTenant {
  if (request.tenant === undefined) {
    throw new Error("tenant resolution hook did not run for a tenant-scoped route");
  }
  return request.tenant;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Platform-level routes carry no tenant.
    if (request.url.startsWith("/v1/platform/")) {
      return;
    }
    const resolution = await resolveRequestTenant({
      host: request.headers.host,
      platformBaseDomain: deps.platformBaseDomain,
      lookup: deps.tenantLookup,
    });
    if (!resolution.ok) {
      await reply.code(failureStatus(resolution)).send({ error: resolution.reason });
      return reply;
    }
    request.tenant = { tenantId: resolution.tenant.tenantId, slug: resolution.tenant.slug };
    return;
  });

  app.post("/v1/platform/tenants", async (request, reply) => {
    const body = request.body as {
      slug: string;
      displayName: string;
      defaultTimezone: string;
      defaultLocale?: string;
    };
    const tenant = await deps.tenantAdmin.createTenant({ ...body, actor: ADMIN_ACTOR });
    await deps.tenantAdmin.addDomain({
      tenantId: tenant.id,
      hostname: `${tenant.slug}.${deps.platformBaseDomain}`,
      kind: "subdomain",
      actor: ADMIN_ACTOR,
    });
    return reply.code(201).send(tenant);
  });

  app.post("/v1/admin/categories", async (request, reply) => {
    const tenant = tenantOf(request);
    const body = request.body as { name: string; sortOrder?: number };
    const category = await deps.catalogService.createCategory({
      tenantId: tenant.tenantId,
      name: body.name,
      sortOrder: body.sortOrder ?? 0,
      actor: ADMIN_ACTOR,
    });
    return reply.code(201).send(category);
  });

  app.post("/v1/admin/services", async (request, reply) => {
    const tenant = tenantOf(request);
    const body = request.body as {
      categoryId: string;
      name: string;
      durationMinutes: number;
      priceAmount: number;
      currency: string;
      bufferBeforeMinutes?: number;
      bufferAfterMinutes?: number;
      minCapacity?: number;
      maxCapacity?: number;
    };
    const service = await deps.catalogService.createService({
      tenantId: tenant.tenantId,
      categoryId: body.categoryId,
      name: body.name,
      durationMinutes: body.durationMinutes,
      priceAmount: body.priceAmount,
      currency: body.currency,
      bufferBeforeMinutes: body.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: body.bufferAfterMinutes ?? 0,
      minCapacity: body.minCapacity ?? 1,
      maxCapacity: body.maxCapacity ?? 1,
      actor: ADMIN_ACTOR,
    });
    return reply.code(201).send(service);
  });

  app.post("/v1/admin/providers", async (request, reply) => {
    const tenant = tenantOf(request);
    const body = request.body as { email: string; displayName: string; timezone: string };
    const provider = await deps.catalogService.createProvider({
      tenantId: tenant.tenantId,
      email: body.email,
      displayName: body.displayName,
      timezone: body.timezone,
      permissions: [],
      actor: ADMIN_ACTOR,
    });
    return reply.code(201).send(provider);
  });

  app.put("/v1/admin/providers/:providerId/schedule", async (request, reply) => {
    const tenant = tenantOf(request);
    const { providerId } = request.params as { providerId: string };
    const body = request.body as { entries: ProviderScheduleEntry[] };
    await deps.catalogService.setProviderSchedule({
      tenantId: tenant.tenantId,
      providerId,
      entries: body.entries,
      actor: ADMIN_ACTOR,
    });
    return reply.code(204).send();
  });

  app.put("/v1/admin/providers/:providerId/locations", async (request, reply) => {
    const tenant = tenantOf(request);
    const { providerId } = request.params as { providerId: string };
    const body = request.body as { locationIds: string[] };
    await deps.catalogService.setProviderLocations({
      tenantId: tenant.tenantId,
      providerId,
      locationIds: body.locationIds,
      actor: ADMIN_ACTOR,
    });
    return reply.code(204).send();
  });

  app.post("/v1/admin/resources", async (request, reply) => {
    const tenant = tenantOf(request);
    const body = request.body as { name: string; quantity: number };
    const resource = await deps.catalogService.createResource({
      tenantId: tenant.tenantId,
      name: body.name,
      quantity: body.quantity,
      actor: ADMIN_ACTOR,
    });
    return reply.code(201).send(resource);
  });

  // Resource hub configuration (ADR-0016): the resource declares the services it
  // serves, the sites it exists at, and the providers eligible to use it.
  if (deps.resourceHub !== undefined) {
    const resourceHub = deps.resourceHub;
    app.put("/v1/admin/resources/:resourceId/services", async (request, reply) => {
      const tenant = tenantOf(request);
      const { resourceId } = request.params as { resourceId: string };
      const body = request.body as { serviceIds: string[] };
      await resourceHub.setServices({
        tenantId: tenant.tenantId,
        resourceId,
        serviceIds: body.serviceIds,
        actor: ADMIN_ACTOR,
      });
      return reply.code(204).send();
    });

    app.put("/v1/admin/resources/:resourceId/locations", async (request, reply) => {
      const tenant = tenantOf(request);
      const { resourceId } = request.params as { resourceId: string };
      const body = request.body as { locationIds: string[] };
      await resourceHub.setLocations({
        tenantId: tenant.tenantId,
        resourceId,
        locationIds: body.locationIds,
        actor: ADMIN_ACTOR,
      });
      return reply.code(204).send();
    });

    app.put("/v1/admin/resources/:resourceId/employees", async (request, reply) => {
      const tenant = tenantOf(request);
      const { resourceId } = request.params as { resourceId: string };
      const body = request.body as { providerIds: string[] };
      await resourceHub.setEmployees({
        tenantId: tenant.tenantId,
        resourceId,
        providerIds: body.providerIds,
        actor: ADMIN_ACTOR,
      });
      return reply.code(204).send();
    });

    app.get("/v1/admin/resources/:resourceId/hub", async (request, reply) => {
      const tenant = tenantOf(request);
      const { resourceId } = request.params as { resourceId: string };
      const hub = await resourceHub.getHub(tenant.tenantId, resourceId);
      return reply.send(hub);
    });
  }

  app.post("/v1/admin/services/:serviceId/providers", async (request, reply) => {
    const tenant = tenantOf(request);
    const { serviceId } = request.params as { serviceId: string };
    const body = request.body as { providerId: string };
    await deps.catalogService.assignProvider({
      tenantId: tenant.tenantId,
      serviceId,
      providerId: body.providerId,
      actor: ADMIN_ACTOR,
    });
    return reply.code(204).send();
  });

  app.get("/v1/public/widget-config", async (request, reply) => {
    const tenant = tenantOf(request);
    const { serviceId } = request.query as { serviceId?: string };
    if (serviceId === undefined) {
      return reply.code(400).send({ error: "serviceId is required" });
    }
    const config = await deps.availability.widgetConfig(tenant.tenantId, serviceId);
    if (config === null) {
      return reply.code(404).send({ error: "service-not-found" });
    }
    return reply.send(config);
  });

  app.get("/v1/public/availability", async (request, reply) => {
    const tenant = tenantOf(request);
    const query = request.query as {
      serviceId?: string;
      date?: string;
      providerId?: string;
      extraIds?: string;
    };
    if (query.serviceId === undefined || query.date === undefined) {
      return reply.code(400).send({ error: "serviceId and date are required" });
    }
    const result = await deps.availability.availability({
      tenantId: tenant.tenantId,
      serviceId: query.serviceId,
      date: query.date,
      ...(query.providerId !== undefined ? { providerId: query.providerId } : {}),
      ...(query.extraIds !== undefined ? { extraIds: query.extraIds.split(",") } : {}),
      tenantTimezone: await deps.tenantTimezone(tenant.tenantId),
    });
    if (!result.ok) {
      const status = result.reason === "service-not-found" ? 404 : 400;
      return reply.code(status).send({ error: result.reason });
    }
    return reply.send({
      providerId: result.provider.id,
      providerSelection: result.providerSelection,
      slots: result.slots,
    });
  });

  if (deps.checkout !== undefined) {
    registerCheckoutRoutes(app, {
      ...deps.checkout,
      availability: deps.availability,
      tenantTimezone: (tenantId) => deps.tenantTimezone(tenantId),
    });
  }
  if (deps.portal !== undefined) {
    registerPortalRoutes(app, deps.portal);
  }
  if (deps.events !== undefined) {
    registerEventRoutes(app, deps.events);
  }
  if (deps.calendarWebhooks !== undefined) {
    registerCalendarWebhookRoutes(app, deps.calendarWebhooks);
  }

  return app;
}
