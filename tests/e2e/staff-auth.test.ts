/**
 * Staff authentication gate over HTTP (ADR-0005). With `staffAuth` wired,
 * /v1/admin/* requires an admin staff session: unauthenticated requests are
 * rejected, login mints a staff_session cookie, admin role passes the gate,
 * non-admin staff are forbidden, and logout invalidates the session.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { StaffAuthService } from "@saas-reservas/api/application/identity/staff-auth-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import { InMemoryStaffAccountStore } from "@saas-reservas/api/infrastructure/memory/in-memory-staff-account-store";

const HOST = "spa.reservas.test";

describe("staff auth gate", () => {
  let app: FastifyInstance;
  let events: InMemoryEventSink;
  let tenantId: string;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed at call sites
  async function call<T>(
    method: "GET" | "POST" | "DELETE",
    url: string,
    options: { payload?: unknown; cookie?: string } = {},
  ): Promise<{ status: number; body: T; setCookie?: string }> {
    const headers: Record<string, string> = { host: HOST };
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

  /** Extracts the staff_session cookie pair from a Set-Cookie header. */
  function sessionCookie(setCookie: string | undefined): string {
    const value = (setCookie ?? "").split(";")[0] ?? "";
    return value;
  }

  beforeAll(async () => {
    const store = new InMemoryStore();
    events = new InMemoryEventSink();
    app = buildApp({
      platformBaseDomain: "reservas.test",
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      staffAuth: new StaffAuthService(new InMemoryStaffAccountStore(), events),
      availability: new AvailabilityService(store, store),
      tenantTimezone: async (id) => (await store.findTenantById(id))?.defaultTimezone ?? "UTC",
    });

    const tenant = await call<{ id: string }>("POST", "/v1/platform/tenants", {
      payload: { slug: "spa", displayName: "Spa", defaultTimezone: "Europe/Madrid" },
    });
    tenantId = tenant.body.id;
  });

  it("rejects unauthenticated admin requests", async () => {
    const res = await call("POST", "/v1/admin/categories", { payload: { name: "Spa" } });
    expect(res.status).toBe(401);
  });

  it("provisions an admin, logs in, and passes the gate; logout revokes access", async () => {
    const created = await call<{ id: string; role: string }>(
      "POST",
      `/v1/platform/tenants/${tenantId}/staff`,
      { payload: { email: "Admin@Spa.test", password: "supersecret", role: "admin" } },
    );
    expect(created.status).toBe(201);
    expect(created.body.role).toBe("admin");

    // Wrong password is rejected.
    const bad = await call("POST", "/v1/admin/sessions", {
      payload: { email: "admin@spa.test", password: "nope-nope-nope" },
    });
    expect(bad.status).toBe(401);

    // Correct credentials mint a staff_session cookie.
    const login = await call<{ role: string }>("POST", "/v1/admin/sessions", {
      payload: { email: "admin@spa.test", password: "supersecret" },
    });
    expect(login.status).toBe(201);
    expect(login.setCookie).toContain("staff_session=");
    expect(login.setCookie).toContain("HttpOnly");
    const cookie = sessionCookie(login.setCookie);

    // Authenticated admin passes the gate; the audit actor is the staff member.
    const ok = await call<{ id: string }>("POST", "/v1/admin/categories", {
      payload: { name: "Spa" },
      cookie,
    });
    expect(ok.status).toBe(201);
    const createdEvent = events.events.find((e) => e.type === "catalog.category-created");
    expect(createdEvent?.actor.type).toBe("staff");

    // Logout invalidates the session.
    const out = await call("DELETE", "/v1/admin/sessions", { cookie });
    expect(out.status).toBe(204);
    const afterLogout = await call("POST", "/v1/admin/categories", {
      payload: { name: "Other" },
      cookie,
    });
    expect(afterLogout.status).toBe(401);
  });

  it("forbids non-admin staff from admin routes", async () => {
    await call("POST", `/v1/platform/tenants/${tenantId}/staff`, {
      payload: { email: "ops@spa.test", password: "supersecret", role: "staff" },
    });
    const login = await call("POST", "/v1/admin/sessions", {
      payload: { email: "ops@spa.test", password: "supersecret" },
    });
    const cookie = sessionCookie(login.setCookie);
    const res = await call("POST", "/v1/admin/categories", { payload: { name: "X" }, cookie });
    expect(res.status).toBe(403);
  });
});
