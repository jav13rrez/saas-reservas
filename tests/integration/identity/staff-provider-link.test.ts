/**
 * Integration: vínculo proveedor↔staff (feature 002, US4 / T027).
 *
 * Cubre el escenario 6 del quickstart:
 *  - vincular proveedor a staff → 200
 *  - intentar vincular el mismo proveedor a otro staff → 409
 *  - ambos lados opcionales (staff sin proveedor, proveedor sin staff)
 *  - desvincular → 200; ambos registros intactos
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
const BOOTSTRAP_SECRET = "link-test-bootstrap-secret-32-chars!";

describe("staff ↔ provider link", () => {
  let app: FastifyInstance;

  let adminSession: string;
  let staff1Id: string;
  let staff2Id: string;
  let providerId: string;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed at call sites
  async function call<T = unknown>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    options: { payload?: unknown; cookie?: string; host?: string } = {},
  ): Promise<{ status: number; body: T; setCookie?: string }> {
    const headers: Record<string, string> = { host: options.host ?? PLATFORM_HOST };
    if (options.cookie !== undefined) headers.cookie = options.cookie;
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

  beforeAll(async () => {
    const store = new InMemoryStore();
    const events = new InMemoryEventSink();
    const staffStore = new InMemoryStaffAccountStore();

    app = buildApp({
      platformBaseDomain: PLATFORM_HOST,
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      staffAuth: new StaffAuthService(staffStore, events),
      platformAuth: new PlatformAuthService(new InMemoryPlatformOperatorStore(), events),
      platformBootstrapSecret: BOOTSTRAP_SECRET,
      availability: new AvailabilityService(store, store),
      tenantTimezone: async (id) => (await store.findTenantById(id))?.defaultTimezone ?? "UTC",
    });

    // Bootstrap platform operator y sesión
    await call("POST", "/v1/platform/operators/bootstrap", {
      payload: {
        secret: BOOTSTRAP_SECRET,
        email: "owner@platform.test",
        password: "platform-pw-32chars!!",
        displayName: "Owner",
      },
    });
    const platformLogin = await call("POST", "/v1/platform/sessions", {
      payload: { email: "owner@platform.test", password: "platform-pw-32chars!!" },
    });
    const platformSession = sessionCookie(platformLogin.setCookie);

    // Provision tenant + primer admin (staff1)
    const tenant = await call<{ id: string }>("POST", "/v1/platform/tenants", {
      cookie: platformSession,
      payload: { slug: "spa", displayName: "Spa Test", defaultTimezone: "UTC" },
    });
    const tenantId = tenant.body.id;

    await call("POST", `/v1/platform/tenants/${tenantId}/staff`, {
      cookie: platformSession,
      payload: { email: "admin@spa.test", password: "admin-pw-32chars!!", role: "admin" },
    });

    const loginRes = await call<{ staffId: string }>("POST", "/v1/admin/sessions", {
      host: TENANT_HOST,
      payload: { email: "admin@spa.test", password: "admin-pw-32chars!!" },
    });
    adminSession = sessionCookie(loginRes.setCookie);
    staff1Id = loginRes.body.staffId;

    // Crear staff2 dentro del tenant
    const staff2Res = await call<{ id: string }>("POST", "/v1/admin/staff", {
      host: TENANT_HOST,
      cookie: adminSession,
      payload: { email: "staff2@spa.test", password: "staff2-pw-32chars!!", role: "staff" },
    });
    staff2Id = staff2Res.body.id;

    // Crear un proveedor
    const providerRes = await call<{ id: string }>("POST", "/v1/admin/providers", {
      host: TENANT_HOST,
      cookie: adminSession,
      payload: { email: "provider@spa.test", displayName: "Carlos", timezone: "UTC" },
    });
    providerId = providerRes.body.id;
  });

  it("vincula un proveedor a staff1 → 200 con providerId en respuesta", async () => {
    const res = await call<{ id: string; providerId: string | null }>(
      "PATCH",
      `/v1/admin/staff/${staff1Id}`,
      { host: TENANT_HOST, cookie: adminSession, payload: { providerId } },
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(staff1Id);
    expect(res.body.providerId).toBe(providerId);
  });

  it("rechaza vincular el mismo proveedor a staff2 → 409", async () => {
    const res = await call("PATCH", `/v1/admin/staff/${staff2Id}`, {
      host: TENANT_HOST,
      cookie: adminSession,
      payload: { providerId },
    });
    expect(res.status).toBe(409);
  });

  it("staff sin proveedor (staff2) es válido — ambos lados opcionales", async () => {
    const res = await call<{ id: string; providerId: string | null }>(
      "PATCH",
      `/v1/admin/staff/${staff2Id}`,
      { host: TENANT_HOST, cookie: adminSession, payload: { providerId: null } },
    );
    // Desvincular cuando ya no hay vínculo no es error
    expect(res.status).toBe(200);
    expect(res.body.providerId).toBeNull();
  });

  it("desvincula staff1 → 200; proveedor y staff siguen existiendo", async () => {
    const res = await call<{ id: string; providerId: string | null }>(
      "PATCH",
      `/v1/admin/staff/${staff1Id}`,
      { host: TENANT_HOST, cookie: adminSession, payload: { providerId: null } },
    );
    expect(res.status).toBe(200);
    expect(res.body.providerId).toBeNull();

    // Tras desvincular, el proveedor debe seguir listándose
    const providers = await call<{ items: { id: string }[] }>("GET", "/v1/admin/providers", {
      host: TENANT_HOST,
      cookie: adminSession,
    });
    expect(providers.body.items.some((p) => p.id === providerId)).toBe(true);
  });

  it("devuelve 404 si el staffId no existe en el tenant", async () => {
    const res = await call("PATCH", "/v1/admin/staff/00000000-0000-0000-0000-000000000000", {
      host: TENANT_HOST,
      cookie: adminSession,
      payload: { providerId: null },
    });
    expect(res.status).toBe(404);
  });

  it("devuelve 404 si el providerId no existe en el tenant", async () => {
    const res = await call("PATCH", `/v1/admin/staff/${staff2Id}`, {
      host: TENANT_HOST,
      cookie: adminSession,
      payload: { providerId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status).toBe(404);
  });
});
