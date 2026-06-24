/**
 * Platform tenant lifecycle gate (ADR-0022 / feature 002, US2).
 *
 * Covers quickstart Scenarios 3 & 4: tenant provisioning and first-admin
 * bootstrap require a platform session; suspension blocks new staff sign-ins
 * and new public bookings while preserving data; reactivation restores normal
 * operation.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { StaffAuthService } from "@saas-reservas/api/application/identity/staff-auth-service";
import { PlatformAuthService } from "@saas-reservas/api/application/identity/platform-auth-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import { InMemoryStaffAccountStore } from "@saas-reservas/api/infrastructure/memory/in-memory-staff-account-store";
import { InMemoryPlatformOperatorStore } from "@saas-reservas/api/infrastructure/memory/in-memory-platform-operator-store";

const PLATFORM_HOST = "reservas.test";
const BOOTSTRAP_SECRET = "bootstrap-secret-value-at-least-32-chars";

describe("platform tenant lifecycle", () => {
  let app: FastifyInstance;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed at call sites
  async function call<T>(
    method: "GET" | "POST" | "DELETE" | "PATCH",
    url: string,
    options: { payload?: unknown; cookie?: string; host?: string } = {},
  ): Promise<{ status: number; body: T; setCookie?: string }> {
    const headers: Record<string, string> = { host: options.host ?? PLATFORM_HOST };
    if (options.cookie !== undefined) {
      headers.cookie = options.cookie;
    }
    const response = await app.inject({
      method,
      url,
      headers,
      ...(options.payload !== undefined
        ? { payload: options.payload as Record<string, unknown> }
        : {}),
    });
    const setCookie = response.headers["set-cookie"];
    return {
      status: response.statusCode,
      body: response.body.length > 0 ? response.json<T>() : ({} as T),
      ...(typeof setCookie === "string" ? { setCookie } : {}),
    };
  }

  function sessionCookie(setCookie: string | undefined): string {
    return (setCookie ?? "").split(";")[0] ?? "";
  }

  let platformSession: string;
  let tenantId: string;
  let tenantHost: string;

  beforeAll(async () => {
    const store = new InMemoryStore();
    const events = new InMemoryEventSink();
    app = buildApp({
      platformBaseDomain: PLATFORM_HOST,
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      staffAuth: new StaffAuthService(new InMemoryStaffAccountStore(), events),
      platformAuth: new PlatformAuthService(new InMemoryPlatformOperatorStore(), events),
      platformBootstrapSecret: BOOTSTRAP_SECRET,
      availability: new AvailabilityService(store, store),
      tenantTimezone: async (id) => (await store.findTenantById(id))?.defaultTimezone ?? "UTC",
    });

    // Bootstrap first operator, then login.
    await call("POST", "/v1/platform/operators/bootstrap", {
      payload: {
        secret: BOOTSTRAP_SECRET,
        email: "owner@platform.test",
        password: "supersecret-pw",
        displayName: "Owner",
      },
    });
    const login = await call<{ operatorId: string }>("POST", "/v1/platform/sessions", {
      payload: { email: "owner@platform.test", password: "supersecret-pw" },
    });
    platformSession = sessionCookie(login.setCookie);
  });

  it("Scenario 3: operator provisions tenant and bootstraps first admin", async () => {
    // Create tenant (requires platform session).
    const tenant = await call<{ id: string; slug: string }>("POST", "/v1/platform/tenants", {
      cookie: platformSession,
      payload: { slug: "spa", displayName: "Spa Test", defaultTimezone: "Europe/Madrid" },
    });
    expect(tenant.status).toBe(201);
    tenantId = tenant.body.id;
    tenantHost = `spa.${PLATFORM_HOST}`;

    // Bootstrap first tenant admin (requires platform session).
    const staff = await call("POST", `/v1/platform/tenants/${tenantId}/staff`, {
      cookie: platformSession,
      payload: { email: "admin@spa.test", password: "staff-password-32", role: "admin" },
    });
    expect(staff.status).toBe(201);

    // The new admin can sign in via the tenant host.
    const staffLogin = await call<{ staffId: string }>("POST", "/v1/admin/sessions", {
      host: tenantHost,
      payload: { email: "admin@spa.test", password: "staff-password-32" },
    });
    expect(staffLogin.status).toBe(201);
  });

  it("Scenario 4: suspension blocks staff login; reactivation restores it", async () => {
    // Suspend the tenant.
    const suspend = await call<{ id: string; status: string }>(
      "PATCH",
      `/v1/platform/tenants/${tenantId}`,
      { cookie: platformSession, payload: { status: "suspended" } },
    );
    expect(suspend.status).toBe(200);
    expect(suspend.body.status).toBe("suspended");

    // Staff login on a suspended tenant must be rejected (tenant resolver blocks the request).
    const blockedLogin = await call("POST", "/v1/admin/sessions", {
      host: tenantHost,
      payload: { email: "admin@spa.test", password: "staff-password-32" },
    });
    expect(blockedLogin.status).toBe(403);

    // Public availability is also blocked by the resolver.
    const blockedAvailability = await call("GET", "/v1/public/availability", {
      host: tenantHost,
    });
    expect(blockedAvailability.status).toBe(403);

    // Reactivate.
    const reactivate = await call<{ id: string; status: string }>(
      "PATCH",
      `/v1/platform/tenants/${tenantId}`,
      { cookie: platformSession, payload: { status: "active" } },
    );
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.status).toBe("active");

    // Staff login works again after reactivation.
    const restoredLogin = await call<{ staffId: string }>("POST", "/v1/admin/sessions", {
      host: tenantHost,
      payload: { email: "admin@spa.test", password: "staff-password-32" },
    });
    expect(restoredLogin.status).toBe(201);
  });

  it("PATCH requires a platform session", async () => {
    const noAuth = await call("PATCH", `/v1/platform/tenants/${tenantId}`, {
      payload: { status: "suspended" },
    });
    expect(noAuth.status).toBe(401);
  });
});
