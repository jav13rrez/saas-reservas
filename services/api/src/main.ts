/**
 * Local dev server entry point.
 *
 * Wires up in-memory adapters (same pattern as tests/e2e/checkout-flow.test.ts),
 * seeds the store with DEMO_TENANTS, and starts Fastify on port 3001.
 * Also registers a GET /v1/ops/tenants route for the operations dashboard.
 */

import { buildApp } from "./api/availability-routes.js";
import { BookingService } from "./application/bookings/booking-service.js";
import { CatalogService } from "./application/catalog/catalog-service.js";
import { ResourceHubService } from "./application/catalog/resource-hub-service.js";
import { CartReconciliationService } from "./application/payments/cart-reconciliation-service.js";
import { AvailabilityService } from "./application/scheduling/availability-service.js";
import { CheckoutLockService } from "./application/scheduling/checkout-lock-service.js";
import { InMemoryEventSink } from "./application/events.js";
import { TenantAdminService } from "./application/tenancy/tenant-admin-service.js";
import { InMemoryLockStore } from "./infrastructure/memory/in-memory-lock-store.js";
import { InMemoryPaymentStore } from "./infrastructure/memory/in-memory-payment-store.js";
import { InMemoryStore } from "./infrastructure/memory/in-memory-store.js";
import {
  InMemoryProcessedWebhookStore,
  WebhookProcessor,
} from "./infrastructure/payments/payment-webhooks.js";
import { FakePaymentGateway } from "@saas-reservas/integrations/payments/payment-gateway";
import { DEMO_TENANTS } from "./seeds/demo-tenants.js";
import {
  STARTER_PLAN,
  PROFESSIONAL_PLAN,
  ENTERPRISE_PLAN,
} from "@saas-reservas/domain/billing/billing";
import type { BillingPlan } from "@saas-reservas/domain/billing/billing";
import type { Tenant } from "@saas-reservas/domain/tenancy/tenant";
import { DEFAULT_BRANDING, DEFAULT_POLICIES } from "@saas-reservas/domain/tenancy/tenant";

// ---------------------------------------------------------------------------
// TenantOverview shape (mirrors apps/admin/src/features/operations/index.tsx)
// ---------------------------------------------------------------------------

interface TenantOverview {
  tenantId: string;
  tenantName: string;
  planName: string;
  billingStatus: "trialing" | "active" | "past_due" | "canceled" | "paused";
  bookingsThisPeriod: number;
  bookingsQuota: number;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  notificationsThisPeriod: number;
  notificationsQuota: number;
}

// ---------------------------------------------------------------------------
// Plan lookup helper
// ---------------------------------------------------------------------------

const ALL_PLANS: BillingPlan[] = [STARTER_PLAN, PROFESSIONAL_PLAN, ENTERPRISE_PLAN];

function planById(id: string): BillingPlan {
  return ALL_PLANS.find((p) => p.id === id) ?? STARTER_PLAN;
}

// ---------------------------------------------------------------------------
// Build TenantOverview array from DEMO_TENANTS
// ---------------------------------------------------------------------------

const TENANT_OVERVIEWS: TenantOverview[] = DEMO_TENANTS.map((dt) => {
  const plan = planById(dt.plan.id);
  const bookingsThisPeriod = dt.bookings.length * 30;
  return {
    tenantId: dt.id,
    tenantName: dt.name,
    planName: plan.name,
    billingStatus: "active" as const,
    bookingsThisPeriod,
    bookingsQuota: plan.quotas.bookingsPerMonth,
    storageUsedBytes: Math.round(plan.quotas.storageBytes * 0.18),
    storageQuotaBytes: plan.quotas.storageBytes,
    notificationsThisPeriod: Math.round(plan.quotas.notificationsPerMonth * 0.12),
    notificationsQuota: plan.quotas.notificationsPerMonth,
  };
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const store = new InMemoryStore();
const paymentStore = new InMemoryPaymentStore();
const gateway = new FakePaymentGateway();
const events = new InMemoryEventSink();

const bookings = new BookingService(paymentStore, events);
const carts = new CartReconciliationService(paymentStore, gateway, events);

const app = buildApp({
  platformBaseDomain: "localhost",
  tenantLookup: store.tenantLookup(),
  tenantAdmin: new TenantAdminService(store, events),
  catalogService: new CatalogService(store, events),
  resourceHub: new ResourceHubService(store, events),
  availability: new AvailabilityService(store, store),
  tenantTimezone: async (tenantId) =>
    (await store.findTenantById(tenantId))?.defaultTimezone ?? "UTC",
  checkout: {
    catalog: store,
    hub: store,
    locks: new CheckoutLockService(new InMemoryLockStore()),
    bookings,
    carts,
    webhooks: new WebhookProcessor(new InMemoryProcessedWebhookStore(), events),
    occupancy: store,
  },
});

// ---------------------------------------------------------------------------
// Seed the first DEMO_TENANT (demo-tenant-professional) into the store
// ---------------------------------------------------------------------------

const firstDemoTenant = DEMO_TENANTS[0];

if (firstDemoTenant !== undefined) {
  const seedTenant: Tenant = {
    id: firstDemoTenant.id,
    slug: firstDemoTenant.slug,
    displayName: firstDemoTenant.name,
    status: "active",
    defaultTimezone: "Europe/Madrid",
    defaultLocale: "es",
    branding: DEFAULT_BRANDING,
    policies: DEFAULT_POLICIES,
  };
  await store.insertTenant(seedTenant);
}

// ---------------------------------------------------------------------------
// Platform-level ops route (not tenant-scoped)
// ---------------------------------------------------------------------------

app.get("/v1/ops/tenants", async (_request, reply) => {
  await reply.send(TENANT_OVERVIEWS);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

await app.listen({ port: 3001, host: "0.0.0.0" });
console.log("API server listening on http://localhost:3001");
