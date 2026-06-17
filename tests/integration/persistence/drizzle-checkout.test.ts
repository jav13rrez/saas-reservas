/**
 * Persistence adapter (packages/persistence) end to end: the full US1+US2 flow
 * runs against real PostgreSQL through the Drizzle/RLS repositories instead of
 * the in-memory stores — tenant setup, catalog, availability, checkout with
 * holds, webhook approval, occupancy, audit, and cross-tenant RLS isolation.
 * Self-skips when no database is reachable.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { BookingService } from "@saas-reservas/api/application/bookings/booking-service";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { CartReconciliationService } from "@saas-reservas/api/application/payments/cart-reconciliation-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { CheckoutLockService } from "@saas-reservas/api/application/scheduling/checkout-lock-service";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryLockStore } from "@saas-reservas/api/infrastructure/memory/in-memory-lock-store";
import { WebhookProcessor } from "@saas-reservas/api/infrastructure/payments/payment-webhooks";
import { FakePaymentGateway } from "@saas-reservas/integrations/payments/payment-gateway";
import {
  createTenantDb,
  DrizzleCatalogRepository,
  DrizzleResourceHubRepository,
  DrizzleEventSink,
  DrizzleHoldStore,
  DrizzlePaymentRepository,
  DrizzleProcessedWebhookStore,
  DrizzleTenantRepository,
  type TenantDb,
} from "@saas-reservas/persistence";
import { setupDomainDb } from "../helpers/domain-db.js";
import { ADMIN_URL } from "../helpers/postgres.js";

const fixture = await setupDomainDb("drz");

const HOST = "drz-spa.reservas.test";
const DATE = "2026-06-15"; // Monday
const SLOT = "2026-06-15T08:00:00.000Z"; // 10:00 Madrid

if (fixture === null) {
  describe.skip(`Drizzle persistence (PostgreSQL not reachable at ${ADMIN_URL})`, () => {
    it("skipped", () => undefined);
  });
} else {
  describe("Drizzle/RLS persistence adapter", () => {
    let db: TenantDb;
    let app: FastifyInstance;
    let tenantRepo: DrizzleTenantRepository;
    let paymentRepo: DrizzlePaymentRepository;
    let gateway: FakePaymentGateway;
    let tenantId: string;
    let otherTenantId: string;
    let serviceId: string;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed at call sites
    async function post<T>(url: string, payload: unknown): Promise<{ status: number; body: T }> {
      const response = await app.inject({
        method: "POST",
        url,
        headers: { host: HOST },
        payload: payload as Record<string, unknown>,
      });
      return {
        status: response.statusCode,
        body: response.body.length > 0 ? response.json<T>() : ({} as T),
      };
    }

    beforeAll(async () => {
      db = createTenantDb(fixture.appUrl);
      tenantRepo = new DrizzleTenantRepository(db);
      const catalogRepo = new DrizzleCatalogRepository(db);
      const hubRepo = new DrizzleResourceHubRepository(db);
      paymentRepo = new DrizzlePaymentRepository(db);
      const events = new DrizzleEventSink(db);
      gateway = new FakePaymentGateway();

      app = buildApp({
        platformBaseDomain: "reservas.test",
        tenantLookup: tenantRepo.tenantLookup(),
        tenantAdmin: new TenantAdminService(tenantRepo, events),
        catalogService: new CatalogService(catalogRepo, events),
        availability: new AvailabilityService(catalogRepo, hubRepo),
        tenantTimezone: async (id) =>
          (await tenantRepo.findTenantById(id))?.defaultTimezone ?? "UTC",
        checkout: {
          catalog: catalogRepo,
          hub: hubRepo,
          locks: new CheckoutLockService(new InMemoryLockStore()),
          bookings: new BookingService(paymentRepo, events),
          carts: new CartReconciliationService(paymentRepo, gateway, events),
          webhooks: new WebhookProcessor(new DrizzleProcessedWebhookStore(db), events),
          occupancy: catalogRepo,
          holds: new DrizzleHoldStore(db),
        },
      });

      const tenant = await post<{ id: string }>("/v1/platform/tenants", {
        slug: "drz-spa",
        displayName: "Drizzle Spa",
        defaultTimezone: "Europe/Madrid",
      });
      tenantId = tenant.body.id;
      const other = await post<{ id: string }>("/v1/platform/tenants", {
        slug: "drz-other",
        displayName: "Other",
        defaultTimezone: "UTC",
      });
      otherTenantId = other.body.id;

      const category = await post<{ id: string }>("/v1/admin/categories", { name: "Spa" });
      const service = await post<{ id: string }>("/v1/admin/services", {
        categoryId: category.body.id,
        name: "Massage",
        durationMinutes: 60,
        priceAmount: 5000,
        currency: "EUR",
      });
      serviceId = service.body.id;
      const provider = await post<{ id: string }>("/v1/admin/providers", {
        email: "ana@drz.test",
        displayName: "Ana",
        timezone: "Europe/Madrid",
      });
      await post(`/v1/admin/services/${serviceId}/providers`, { providerId: provider.body.id });
      const schedule = await app.inject({
        method: "PUT",
        url: `/v1/admin/providers/${provider.body.id}/schedule`,
        headers: { host: HOST },
        payload: {
          entries: [
            { kind: "weekly", weekday: 1, startTime: "10:00", endTime: "14:00", breaks: [] },
          ],
        },
      });
      expect(schedule.statusCode).toBe(204);
    });

    afterAll(async () => {
      await db.close();
    });

    it("serves availability computed from RLS-protected tables", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/v1/public/availability?serviceId=${serviceId}&date=${DATE}`,
        headers: { host: HOST },
      });
      expect(response.statusCode).toBe(200);
      const { slots } = response.json<{ slots: { startAt: string }[] }>();
      expect(slots.map((slot) => slot.startAt)).toContain(SLOT);
    });

    it("runs the full checkout through Postgres: pending -> webhook -> approved + occupancy", async () => {
      const checkout = await post<{ bookingId: string; cartId: string; status: string }>(
        "/v1/public/checkout",
        {
          serviceId,
          date: DATE,
          startAt: SLOT,
          customer: { email: "eva@example.test", firstName: "Eva", lastName: "P" },
        },
      );
      expect(checkout.status).toBe(201);
      expect(checkout.body.status).toBe("pending");

      // The pending booking and the checkout hold are durable rows now.
      const pending = await paymentRepo.findBookingById(tenantId, checkout.body.bookingId);
      expect(pending?.status).toBe("pending");

      const webhook = await post<{ outcome: string }>("/v1/public/payments/webhook", {
        id: "evt_drz_1",
        type: "charge.succeeded",
        payload: { cartId: checkout.body.cartId },
      });
      expect(webhook.body.outcome).toBe("processed");
      const duplicate = await post<{ outcome: string }>("/v1/public/payments/webhook", {
        id: "evt_drz_1",
        type: "charge.succeeded",
        payload: { cartId: checkout.body.cartId },
      });
      expect(duplicate.body.outcome).toBe("duplicate");

      const approved = await paymentRepo.findBookingById(tenantId, checkout.body.bookingId);
      expect(approved?.status).toBe("approved");

      // Persisted occupancy removes the slot from public availability.
      const availability = await app.inject({
        method: "GET",
        url: `/v1/public/availability?serviceId=${serviceId}&date=${DATE}`,
        headers: { host: HOST },
      });
      const { slots } = availability.json<{ slots: { startAt: string }[] }>();
      expect(slots.map((slot) => slot.startAt)).not.toContain(SLOT);

      // RLS isolation: the same booking id is invisible under another tenant's
      // context, even though the query filters by id alone.
      const crossTenant = await paymentRepo.findBookingById(otherTenantId, checkout.body.bookingId);
      expect(crossTenant).toBeNull();
    });

    it("persists domain events and audit records for the whole flow", async () => {
      const audited = await db.withTenant(tenantId, async (tx) => {
        const result = (await tx.execute(
          sql`SELECT action FROM audit_records ORDER BY occurred_at`,
        )) as unknown as { rows: { action: string }[] };
        return result.rows.map((row) => row.action);
      });
      expect(audited).toContain("tenant.created");
      expect(audited).toContain("booking.created");
      expect(audited).toContain("payment.captured");
      expect(audited).toContain("booking.approved");
      expect(audited).toContain("payment.webhook-processed");

      // And none of it leaks into the other tenant's context.
      const foreign = await db.withTenant(otherTenantId, async (tx) => {
        const result = (await tx.execute(
          sql`SELECT count(*)::int AS count FROM audit_records`,
        )) as unknown as { rows: { count: number }[] };
        return result.rows[0]?.count;
      });
      // Only its own tenant.created + tenant.domain-added; nothing from drz-spa.
      expect(foreign).toBe(2);
    });
  });
}
