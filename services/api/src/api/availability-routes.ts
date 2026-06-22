/**
 * Public availability API and admin catalog API (T025).
 *
 * Every tenant-scoped route resolves the tenant from the Host header on each
 * request (constitution: proxy header injection is only an optimization).
 * Staff authentication (ADR-0005) gates /v1/admin/* when `staffAuth` is wired:
 * an admin `staff_session` cookie is required; login/logout live at
 * /v1/admin/sessions. When `staffAuth` is omitted the routes stay open
 * (development/tests only).
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { SYSTEM_ACTOR, type Actor } from "@saas-reservas/domain/audit/events";
import type { ProviderScheduleEntry } from "@saas-reservas/domain/providers/provider";
import type { StaffRole } from "@saas-reservas/domain/identity/staff";
import type { CatalogService } from "../application/catalog/catalog-service.js";
import type { LocationService } from "../application/catalog/location-service.js";
import type { ResourceHubService } from "../application/catalog/resource-hub-service.js";
import {
  DuplicateCustomerEmailError,
  type CustomerService,
} from "../application/customers/customer-service.js";
import type { AdminBookingService } from "../application/bookings/admin-booking-service.js";
import type { StaffAuthService } from "../application/identity/staff-auth-service.js";
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
  /** Multi-site location management ("ubicaciones"); omit to disable the routes. */
  locations?: LocationService;
  /** Customer registry (admin); omit to disable the routes. */
  customers?: CustomerService;
  /** Admin no-charge bookings ("book on behalf"); omit to disable the routes. */
  adminBookings?: AdminBookingService;
  /** Resource hub configuration (ADR-0016); omit to disable the hub admin routes. */
  resourceHub?: ResourceHubService;
  /**
   * Staff authentication (ADR-0005). When provided, `/v1/admin/*` requires a
   * valid admin staff session and the login/logout/bootstrap routes are exposed.
   * When omitted, `/v1/admin/*` stays open (development/tests).
   */
  staffAuth?: StaffAuthService;
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

interface RequestStaff {
  id: string;
  role: StaffRole;
}

declare module "fastify" {
  interface FastifyRequest {
    tenant?: RequestTenant;
    staff?: RequestStaff;
  }
}

/** Reads a cookie value from the request's Cookie header, or null. */
function cookieValue(request: FastifyRequest, name: string): string | null {
  const header = request.headers.cookie;
  if (header === undefined) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return null;
}

function serializeCookie(cookie: {
  name: string;
  value: string;
  maxAgeSeconds: number;
  path: string;
  sameSite: string;
}): string {
  return `${cookie.name}=${cookie.value}; Max-Age=${String(cookie.maxAgeSeconds)}; Path=${cookie.path}; HttpOnly; Secure; SameSite=${cookie.sameSite}`;
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

/**
 * The first value of the X-Forwarded-Host header, if present. Proxies may append
 * a comma-separated list; the left-most entry is the original client-facing host.
 */
function forwardedHost(request: FastifyRequest): string | undefined {
  const raw = request.headers["x-forwarded-host"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) {
    return undefined;
  }
  const first = value.split(",")[0]?.trim();
  return first !== undefined && first.length > 0 ? first : undefined;
}

function tenantOf(request: FastifyRequest): RequestTenant {
  if (request.tenant === undefined) {
    throw new Error("tenant resolution hook did not run for a tenant-scoped route");
  }
  return request.tenant;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  // JSON parser that keeps the raw body on the request. Webhook signature
  // verification (Stripe) must hash the exact bytes received; re-serialized JSON
  // would not match. Handlers still receive parsed JSON, so behavior is otherwise
  // unchanged. An empty body parses to undefined (no payload), matching routes
  // that POST without one.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body: string, done) => {
      (request as unknown as { rawBody?: string }).rawBody = body;
      if (body.length === 0) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(body));
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Platform-level routes carry no tenant.
    if (request.url.startsWith("/v1/platform/") || request.url.startsWith("/v1/ops/")) {
      return;
    }
    // Tenant routing prefers X-Forwarded-Host over Host. Server-to-server callers
    // (e.g. the admin console's api-client, ADR-0018) cannot set Host: the fetch
    // spec lists it as a forbidden header and undici strips it, so they would
    // otherwise route to the API's own host and fail to resolve. The resolver
    // re-validates the value against the tenant registry on every request and the
    // staff-auth gate binds sessions to the host-resolved tenant, so a forged
    // header cannot widen access. SECURITY: a production edge proxy MUST strip any
    // inbound X-Forwarded-Host and set its own before this hop.
    const resolution = await resolveRequestTenant({
      host: forwardedHost(request) ?? request.headers.host,
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

  // Staff auth gate (ADR-0005): when configured, /v1/admin/* requires an admin
  // staff session. Login/logout (/v1/admin/sessions) stay public.
  const staffAuth = deps.staffAuth;
  if (staffAuth !== undefined) {
    app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
      const path = request.url.split("?")[0] ?? request.url;
      if (!path.startsWith("/v1/admin/") || path === "/v1/admin/sessions") {
        return;
      }
      const tenant = request.tenant;
      if (tenant === undefined) {
        await reply.code(404).send({ error: "unknown-host" });
        return reply;
      }
      const sessionId = cookieValue(request, "staff_session");
      const session = sessionId === null ? null : staffAuth.getSession(sessionId, tenant.tenantId);
      if (session === null) {
        await reply.code(401).send({ error: "unauthenticated" });
        return reply;
      }
      if (session.role !== "admin") {
        await reply.code(403).send({ error: "forbidden" });
        return reply;
      }
      request.staff = { id: session.staffId, role: session.role };
      return;
    });
  }

  /** Audit actor for admin routes: the authenticated staff member, else system. */
  const adminActor = (request: FastifyRequest): Actor =>
    request.staff === undefined ? SYSTEM_ACTOR : { type: "staff", id: request.staff.id };

  app.post("/v1/platform/tenants", async (request, reply) => {
    const body = request.body as {
      slug: string;
      displayName: string;
      defaultTimezone: string;
      defaultLocale?: string;
    };
    const tenant = await deps.tenantAdmin.createTenant({ ...body, actor: adminActor(request) });
    await deps.tenantAdmin.addDomain({
      tenantId: tenant.id,
      hostname: `${tenant.slug}.${deps.platformBaseDomain}`,
      kind: "subdomain",
      actor: adminActor(request),
    });
    return reply.code(201).send(tenant);
  });

  if (staffAuth !== undefined) {
    // Bootstrap: a platform operator provisions a tenant's first staff account.
    // (Platform-operator auth itself is out of scope here; this route is the
    // chicken-and-egg entry point before any admin session exists.)
    app.post("/v1/platform/tenants/:tenantId/staff", async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const body = request.body as { email: string; password: string; role?: StaffRole };
      const account = await staffAuth.createAccount({
        tenantId,
        email: body.email,
        password: body.password,
        role: body.role ?? "admin",
        actor: { type: "platform" },
      });
      return reply.code(201).send({ id: account.id, email: account.email, role: account.role });
    });

    // Staff login: exchange credentials for an opaque staff_session cookie.
    app.post("/v1/admin/sessions", async (request, reply) => {
      const tenant = tenantOf(request);
      const body = request.body as { email: string; password: string };
      const result = await staffAuth.authenticate({
        tenantId: tenant.tenantId,
        email: body.email,
        password: body.password,
      });
      if (!result.ok) {
        return reply.code(401).send({ error: result.reason });
      }
      return reply.header("set-cookie", serializeCookie(result.cookie)).code(201).send({
        staffId: result.session.staffId,
        role: result.session.role,
        expiresAt: result.session.expiresAt,
      });
    });

    app.delete("/v1/admin/sessions", async (request, reply) => {
      const sessionId = cookieValue(request, "staff_session");
      if (sessionId !== null) {
        staffAuth.logout(sessionId);
      }
      return reply
        .header("set-cookie", "staff_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax")
        .code(204)
        .send();
    });

    // An authenticated admin provisions additional staff for the tenant.
    app.post("/v1/admin/staff", async (request, reply) => {
      const tenant = tenantOf(request);
      const body = request.body as { email: string; password: string; role?: StaffRole };
      const account = await staffAuth.createAccount({
        tenantId: tenant.tenantId,
        email: body.email,
        password: body.password,
        role: body.role ?? "staff",
        actor: adminActor(request),
      });
      return reply.code(201).send({ id: account.id, email: account.email, role: account.role });
    });
  }

  // Locations ("ubicaciones"): the root of the admin assignment chain. Optional
  // dep so existing fast tests that omit it are unaffected.
  if (deps.locations !== undefined) {
    const locations = deps.locations;
    app.get("/v1/admin/locations", async (request, reply) => {
      const tenant = tenantOf(request);
      const items = await locations.listLocations(tenant.tenantId);
      return reply.send({ items });
    });

    app.post("/v1/admin/locations", async (request, reply) => {
      const tenant = tenantOf(request);
      const body = request.body as { name: string; timezone?: string; address?: string };
      const location = await locations.createLocation({
        tenantId: tenant.tenantId,
        name: body.name,
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        actor: adminActor(request),
      });
      return reply.code(201).send(location);
    });

    app.patch("/v1/admin/locations/:locationId", async (request, reply) => {
      const tenant = tenantOf(request);
      const { locationId } = request.params as { locationId: string };
      const body = request.body as { active?: unknown };
      if (typeof body.active !== "boolean") {
        return reply.code(400).send({ error: "active must be a boolean" });
      }
      const location = await locations.setLocationActive({
        tenantId: tenant.tenantId,
        locationId,
        active: body.active,
        actor: adminActor(request),
      });
      if (location === null) {
        return reply.code(404).send({ error: "location-not-found" });
      }
      return reply.send(location);
    });
  }

  // Customer registry (admin): first-class customers over the `customers` table.
  if (deps.customers !== undefined) {
    const customers = deps.customers;
    app.get("/v1/admin/customers", async (request, reply) => {
      const tenant = tenantOf(request);
      const items = await customers.listCustomers(tenant.tenantId);
      return reply.send({ items });
    });

    app.post("/v1/admin/customers", async (request, reply) => {
      const tenant = tenantOf(request);
      const body = request.body as {
        email: string;
        firstName: string;
        lastName: string;
        phone?: string;
      };
      try {
        const customer = await customers.createCustomer({
          tenantId: tenant.tenantId,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          actor: adminActor(request),
        });
        return await reply.code(201).send(customer);
      } catch (error) {
        if (error instanceof DuplicateCustomerEmailError) {
          return reply.code(409).send({ error: "duplicate-email" });
        }
        throw error;
      }
    });
  }

  // Admin bookings (ADR-0018 Phase 3): staff "book on behalf", no charge.
  if (deps.adminBookings !== undefined) {
    const adminBookings = deps.adminBookings;
    app.get("/v1/admin/bookings", async (request, reply) => {
      const tenant = tenantOf(request);
      const items = await adminBookings.listBookings(tenant.tenantId);
      return reply.send({ items });
    });

    app.post("/v1/admin/bookings", async (request, reply) => {
      const tenant = tenantOf(request);
      const body = request.body as {
        serviceId: string;
        providerId: string;
        customerId: string;
        startAt: string;
        date: string;
      };
      const result = await adminBookings.createBooking({
        tenantId: tenant.tenantId,
        serviceId: body.serviceId,
        providerId: body.providerId,
        customerId: body.customerId,
        startAt: body.startAt,
        date: body.date,
        actor: adminActor(request),
      });
      if (!result.ok) {
        const status = result.reason === "service-not-found" ? 404 : 409;
        return reply.code(status).send({ error: result.reason });
      }
      return reply.code(201).send(result.booking);
    });

    app.post("/v1/admin/bookings/:bookingId/cancel", async (request, reply) => {
      const tenant = tenantOf(request);
      const { bookingId } = request.params as { bookingId: string };
      const canceled = await adminBookings.cancelBooking({
        tenantId: tenant.tenantId,
        bookingId,
        actor: adminActor(request),
      });
      return reply.send(canceled);
    });
  }

  // Admin read model: list endpoints the console renders from. These mirror the
  // create routes above and are gated by the same staff-auth hook.
  app.get("/v1/admin/categories", async (request, reply) => {
    const tenant = tenantOf(request);
    const categories = await deps.catalogService.listCategories(tenant.tenantId);
    return reply.send({ items: categories });
  });

  app.get("/v1/admin/services", async (request, reply) => {
    const tenant = tenantOf(request);
    const services = await deps.catalogService.listServices(tenant.tenantId);
    return reply.send({ items: services });
  });

  app.get("/v1/admin/providers", async (request, reply) => {
    const tenant = tenantOf(request);
    const providers = await deps.catalogService.listProviders(tenant.tenantId);
    return reply.send({
      items: providers.map((entry) => ({
        ...entry.provider,
        serviceIds: entry.serviceIds,
        locationIds: entry.locationIds,
      })),
    });
  });

  app.get("/v1/admin/resources", async (request, reply) => {
    const tenant = tenantOf(request);
    const resources = await deps.catalogService.listResources(tenant.tenantId);
    const resourceHub = deps.resourceHub;
    if (resourceHub === undefined) {
      return reply.send({ items: resources });
    }
    const items = await Promise.all(
      resources.map(async (resource) => {
        const hub = await resourceHub.getHub(tenant.tenantId, resource.id);
        return { ...resource, ...hub };
      }),
    );
    return reply.send({ items });
  });

  app.post("/v1/admin/categories", async (request, reply) => {
    const tenant = tenantOf(request);
    const body = request.body as { name: string; sortOrder?: number };
    const category = await deps.catalogService.createCategory({
      tenantId: tenant.tenantId,
      name: body.name,
      sortOrder: body.sortOrder ?? 0,
      actor: adminActor(request),
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
      actor: adminActor(request),
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
      actor: adminActor(request),
    });
    return reply.code(201).send(provider);
  });

  app.get("/v1/admin/providers/:providerId/schedule", async (request, reply) => {
    const tenant = tenantOf(request);
    const { providerId } = request.params as { providerId: string };
    const entries = await deps.catalogService.listProviderSchedule(tenant.tenantId, providerId);
    return reply.send({ entries });
  });

  app.put("/v1/admin/providers/:providerId/schedule", async (request, reply) => {
    const tenant = tenantOf(request);
    const { providerId } = request.params as { providerId: string };
    const body = request.body as { entries: ProviderScheduleEntry[] };
    await deps.catalogService.setProviderSchedule({
      tenantId: tenant.tenantId,
      providerId,
      entries: body.entries,
      actor: adminActor(request),
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
      actor: adminActor(request),
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
      actor: adminActor(request),
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
        actor: adminActor(request),
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
        actor: adminActor(request),
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
        actor: adminActor(request),
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

  app.patch("/v1/admin/services/:serviceId", async (request, reply) => {
    const tenant = tenantOf(request);
    const { serviceId } = request.params as { serviceId: string };
    const body = request.body as {
      name?: string;
      durationMinutes?: number;
      priceAmount?: number;
      currency?: string;
      bufferBeforeMinutes?: number;
      bufferAfterMinutes?: number;
      minCapacity?: number;
      maxCapacity?: number;
      active?: boolean;
    };
    const patch: Parameters<typeof deps.catalogService.updateService>[0]["patch"] = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
      ...(body.priceAmount !== undefined ? { priceAmount: body.priceAmount } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.bufferBeforeMinutes !== undefined
        ? { bufferBeforeMinutes: body.bufferBeforeMinutes }
        : {}),
      ...(body.bufferAfterMinutes !== undefined
        ? { bufferAfterMinutes: body.bufferAfterMinutes }
        : {}),
      ...(body.minCapacity !== undefined ? { minCapacity: body.minCapacity } : {}),
      ...(body.maxCapacity !== undefined ? { maxCapacity: body.maxCapacity } : {}),
      ...(body.active !== undefined ? { status: body.active ? "active" : "inactive" } : {}),
    };
    const updated = await deps.catalogService.updateService({
      tenantId: tenant.tenantId,
      serviceId,
      patch,
      actor: adminActor(request),
    });
    if (updated === null) {
      return reply.code(404).send({ error: "service-not-found" });
    }
    return reply.send(updated);
  });

  app.patch("/v1/admin/providers/:providerId", async (request, reply) => {
    const tenant = tenantOf(request);
    const { providerId } = request.params as { providerId: string };
    const body = request.body as {
      displayName?: string;
      email?: string;
      timezone?: string;
      active?: boolean;
    };
    const patch: Parameters<typeof deps.catalogService.updateProvider>[0]["patch"] = {
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.active !== undefined ? { status: body.active ? "active" : "inactive" } : {}),
    };
    const updated = await deps.catalogService.updateProvider({
      tenantId: tenant.tenantId,
      providerId,
      patch,
      actor: adminActor(request),
    });
    if (updated === null) {
      return reply.code(404).send({ error: "provider-not-found" });
    }
    return reply.send(updated);
  });

  app.patch("/v1/admin/resources/:resourceId", async (request, reply) => {
    const tenant = tenantOf(request);
    const { resourceId } = request.params as { resourceId: string };
    const body = request.body as { name?: string; quantity?: number; active?: boolean };
    const patch: Parameters<typeof deps.catalogService.updateResource>[0]["patch"] = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
      ...(body.active !== undefined ? { status: body.active ? "active" : "inactive" } : {}),
    };
    const updated = await deps.catalogService.updateResource({
      tenantId: tenant.tenantId,
      resourceId,
      patch,
      actor: adminActor(request),
    });
    if (updated === null) {
      return reply.code(404).send({ error: "resource-not-found" });
    }
    return reply.send(updated);
  });

  app.delete("/v1/admin/services/:serviceId/providers/:providerId", async (request, reply) => {
    const tenant = tenantOf(request);
    const { serviceId, providerId } = request.params as { serviceId: string; providerId: string };
    await deps.catalogService.unassignProvider({
      tenantId: tenant.tenantId,
      serviceId,
      providerId,
      actor: adminActor(request),
    });
    return reply.code(204).send();
  });

  app.post("/v1/admin/services/:serviceId/providers", async (request, reply) => {
    const tenant = tenantOf(request);
    const { serviceId } = request.params as { serviceId: string };
    const body = request.body as { providerId: string };
    await deps.catalogService.assignProvider({
      tenantId: tenant.tenantId,
      serviceId,
      providerId: body.providerId,
      actor: adminActor(request),
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
