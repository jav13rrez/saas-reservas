/**
 * Platform authentication gate over HTTP (ADR-0022 / feature 002, US1).
 *
 * Covers quickstart Scenarios 1 & 2: the first-operator bootstrap is deploy-secret
 * gated and self-locking; the `/v1/platform/*` and `/v1/ops/*` groups are locked
 * without a platform session (401), reject a tenant `staff_session` (403, not
 * interchangeable), and open once a platform session is presented; logout
 * invalidates the session.
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
const TENANT_HOST = "spa.reservas.test";
const BOOTSTRAP_SECRET = "bootstrap-secret-value-at-least-32-chars";

describe("platform auth gate", () => {
  let app: FastifyInstance;
  let events: InMemoryEventSink;

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

  beforeAll(() => {
    const store = new InMemoryStore();
    events = new InMemoryEventSink();
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
    // The cross-tenant operations feed lives outside buildApp in production
    // (main.ts); register a stand-in here so the gate is exercised over /v1/ops/*.
    app.get("/v1/ops/tenants", async (_request, reply) => reply.send([]));
  });

  it("Scenario 1: bootstrap is deploy-secret gated and self-locking", async () => {
    // Fresh platform + wrong secret → 403.
    const badSecret = await call("POST", "/v1/platform/operators/bootstrap", {
      payload: {
        secret: "wrong-secret",
        email: "owner@platform.test",
        password: "supersecret-pw",
        displayName: "Owner",
      },
    });
    expect(badSecret.status).toBe(403);

    // Correct secret → 201 (first operator created).
    const created = await call<{ id: string; email: string }>(
      "POST",
      "/v1/platform/operators/bootstrap",
      {
        payload: {
          secret: BOOTSTRAP_SECRET,
          email: "owner@platform.test",
          password: "supersecret-pw",
          displayName: "Owner",
        },
      },
    );
    expect(created.status).toBe(201);
    expect(created.body.email).toBe("owner@platform.test");

    // Repeat with the correct secret → 409 (self-locked).
    const repeat = await call("POST", "/v1/platform/operators/bootstrap", {
      payload: {
        secret: BOOTSTRAP_SECRET,
        email: "second@platform.test",
        password: "supersecret-pw",
        displayName: "Second",
      },
    });
    expect(repeat.status).toBe(409);

    // Wrong secret after init → still 409 (self-lock precedence over the secret).
    const wrongAfterInit = await call("POST", "/v1/platform/operators/bootstrap", {
      payload: {
        secret: "wrong-secret",
        email: "third@platform.test",
        password: "supersecret-pw",
        displayName: "Third",
      },
    });
    expect(wrongAfterInit.status).toBe(409);
  });

  it("Scenario 2: platform surface is locked without a platform session", async () => {
    // No cookie → 401 on both the ops feed and a platform action.
    expect((await call("GET", "/v1/ops/tenants")).status).toBe(401);
    expect((await call("POST", "/v1/platform/tenants", { payload: {} })).status).toBe(401);

    // Sign in → 200 + platform_session cookie.
    const login = await call<{ operatorId: string }>("POST", "/v1/platform/sessions", {
      payload: { email: "owner@platform.test", password: "supersecret-pw" },
    });
    expect(login.status).toBe(200);
    expect(login.setCookie).toContain("platform_session=");
    expect(login.setCookie).toContain("HttpOnly");
    const platformSession = sessionCookie(login.setCookie);

    // Wrong password → 401, generic.
    const badLogin = await call("POST", "/v1/platform/sessions", {
      payload: { email: "owner@platform.test", password: "nope-nope-nope" },
    });
    expect(badLogin.status).toBe(401);

    // With the platform session, the ops feed opens.
    const ops = await call("GET", "/v1/ops/tenants", { cookie: platformSession });
    expect(ops.status).toBe(200);

    // Provision a tenant (now gated; authenticated) and bootstrap its admin.
    const tenant = await call<{ id: string }>("POST", "/v1/platform/tenants", {
      cookie: platformSession,
      payload: { slug: "spa", displayName: "Spa", defaultTimezone: "Europe/Madrid" },
    });
    expect(tenant.status).toBe(201);
    const staff = await call("POST", `/v1/platform/tenants/${tenant.body.id}/staff`, {
      cookie: platformSession,
      payload: { email: "admin@spa.test", password: "supersecret-pw", role: "admin" },
    });
    expect(staff.status).toBe(201);

    // A tenant staff_session is NOT interchangeable: presented at /v1/ops it is 403.
    const staffLogin = await call("POST", "/v1/admin/sessions", {
      host: TENANT_HOST,
      payload: { email: "admin@spa.test", password: "supersecret-pw" },
    });
    const staffSession = sessionCookie(staffLogin.setCookie);
    const opsWithStaff = await call("GET", "/v1/ops/tenants", { cookie: staffSession });
    expect(opsWithStaff.status).toBe(403);

    // Logout invalidates the platform session.
    const logout = await call("DELETE", "/v1/platform/sessions", { cookie: platformSession });
    expect(logout.status).toBe(204);
    const afterLogout = await call("GET", "/v1/ops/tenants", { cookie: platformSession });
    expect(afterLogout.status).toBe(401);
  });
});
