/**
 * API server entry point with a mode-selectable composition root.
 *
 * - When `DATABASE_URL` is set, the environment is validated (fail-fast,
 *   `@saas-reservas/contracts/environment`) and the app is wired against the
 *   Drizzle/RLS persistence adapters plus a Redis-backed checkout lock store —
 *   the runnable production stack.
 * - Otherwise it falls back to the in-memory adapters for local dev, seeds the
 *   first DEMO_TENANT, and listens on port 3001.
 *
 * The payment gateway is selected at boot: with `STRIPE_SECRET_KEY` set it wires
 * the real Stripe Connect adapter (destination charges + application fee, behind
 * the existing PaymentGateway port); otherwise it stays the deterministic fake so
 * the single-command dev loop is untouched.
 */

import { Redis } from "ioredis";
import { loadEnvironment } from "@saas-reservas/contracts/environment";
import {
  createTenantDb,
  DrizzleCatalogRepository,
  DrizzleLocationRepository,
  DrizzleEventSink,
  DrizzleHoldStore,
  DrizzlePaymentRepository,
  DrizzleProcessedWebhookStore,
  DrizzleResourceHubRepository,
  DrizzleStaffAccountRepository,
  DrizzleTenantRepository,
} from "@saas-reservas/persistence";
import {
  FakePaymentGateway,
  type PaymentGateway,
} from "@saas-reservas/integrations/payments/payment-gateway";
import { StripePaymentGateway } from "@saas-reservas/integrations/payments/stripe-gateway";
import { FetchStripeHttp } from "@saas-reservas/integrations/payments/stripe-http";
import {
  EnvelopeCredentialVault,
  InMemoryKmsAdapter,
  InMemoryVaultStorage,
} from "@saas-reservas/integrations/security/credential-vault";
import type { BillingPlan } from "@saas-reservas/domain/billing/billing";
import {
  ENTERPRISE_PLAN,
  PROFESSIONAL_PLAN,
  STARTER_PLAN,
} from "@saas-reservas/domain/billing/billing";
import type { Tenant } from "@saas-reservas/domain/tenancy/tenant";
import { DEFAULT_BRANDING, DEFAULT_POLICIES } from "@saas-reservas/domain/tenancy/tenant";
import { buildApp, type AppDeps } from "./api/availability-routes.js";
import { AdminBookingService } from "./application/bookings/admin-booking-service.js";
import { BookingService } from "./application/bookings/booking-service.js";
import { CatalogService } from "./application/catalog/catalog-service.js";
import { LocationService } from "./application/catalog/location-service.js";
import { ResourceHubService } from "./application/catalog/resource-hub-service.js";
import { CustomerService } from "./application/customers/customer-service.js";
import { StaffAuthService } from "./application/identity/staff-auth-service.js";
import { CartReconciliationService } from "./application/payments/cart-reconciliation-service.js";
import { AvailabilityService } from "./application/scheduling/availability-service.js";
import { CheckoutLockService } from "./application/scheduling/checkout-lock-service.js";
import { InMemoryEventSink } from "./application/events.js";
import { TenantAdminService } from "./application/tenancy/tenant-admin-service.js";
import { InMemoryLockStore } from "./infrastructure/memory/in-memory-lock-store.js";
import { InMemoryPaymentStore } from "./infrastructure/memory/in-memory-payment-store.js";
import { InMemoryStore } from "./infrastructure/memory/in-memory-store.js";
import { InMemoryStaffAccountStore } from "./infrastructure/memory/in-memory-staff-account-store.js";
import {
  InMemoryProcessedWebhookStore,
  WebhookProcessor,
} from "./infrastructure/payments/payment-webhooks.js";
import { RedisLockStore } from "./infrastructure/redis/redis-lock-store.js";
import { DEMO_TENANTS } from "./seeds/demo-tenants.js";

// ---------------------------------------------------------------------------
// Operations dashboard feed (demo data; mirrors apps/admin operations view)
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

const ALL_PLANS: BillingPlan[] = [STARTER_PLAN, PROFESSIONAL_PLAN, ENTERPRISE_PLAN];

function planById(id: string): BillingPlan {
  return ALL_PLANS.find((p) => p.id === id) ?? STARTER_PLAN;
}

const TENANT_OVERVIEWS: TenantOverview[] = DEMO_TENANTS.map((dt) => {
  const plan = planById(dt.plan.id);
  return {
    tenantId: dt.id,
    tenantName: dt.name,
    planName: plan.name,
    billingStatus: "active" as const,
    bookingsThisPeriod: dt.bookings.length * 30,
    bookingsQuota: plan.quotas.bookingsPerMonth,
    storageUsedBytes: Math.round(plan.quotas.storageBytes * 0.18),
    storageQuotaBytes: plan.quotas.storageBytes,
    notificationsThisPeriod: Math.round(plan.quotas.notificationsPerMonth * 0.12),
    notificationsQuota: plan.quotas.notificationsPerMonth,
  };
});

// ---------------------------------------------------------------------------
// Payment gateway selection
// ---------------------------------------------------------------------------

/**
 * Real Stripe gateway when `STRIPE_SECRET_KEY` is configured, otherwise the
 * deterministic fake. The platform secret key is sealed in an envelope vault so
 * the gateway never receives a bare key; per-tenant Stripe Connect account ids
 * (written by StripeConnectService) turn charges into destination charges with
 * an application fee. Without a connected account it falls back to a plain
 * platform charge, so a single-merchant deployment also works.
 */
async function resolvePaymentGateway(): Promise<PaymentGateway> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey === undefined || secretKey.length === 0) {
    return new FakePaymentGateway();
  }

  const vault = new EnvelopeCredentialVault(new InMemoryKmsAdapter(), new InMemoryVaultStorage());
  await vault.store("platform", "stripe", "secret_key", secretKey);

  const feeBps = Number.parseInt(process.env.STRIPE_APPLICATION_FEE_BPS ?? "0", 10);
  const baseUrl = process.env.STRIPE_API_BASE_URL;
  return new StripePaymentGateway({
    http: baseUrl !== undefined ? new FetchStripeHttp(baseUrl) : new FetchStripeHttp(),
    vault,
    applicationFeeBasisPoints: Number.isFinite(feeBps) ? feeBps : 0,
  });
}

// ---------------------------------------------------------------------------
// Composition roots
// ---------------------------------------------------------------------------

interface Bootstrap {
  deps: AppDeps;
  host: string;
  port: number;
  mode: "persistent" | "in-memory";
  seed(): Promise<void>;
  close(): Promise<void>;
}

/** Production stack: Drizzle/RLS persistence + Redis checkout locks. */
async function persistentBootstrap(): Promise<Bootstrap> {
  const env = loadEnvironment(process.env);
  const db = createTenantDb(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const tenantRepo = new DrizzleTenantRepository(db);
  const catalogRepo = new DrizzleCatalogRepository(db);
  const locationRepo = new DrizzleLocationRepository(db);
  const hubRepo = new DrizzleResourceHubRepository(db);
  const staffRepo = new DrizzleStaffAccountRepository(db);
  const paymentRepo = new DrizzlePaymentRepository(db);
  const events = new DrizzleEventSink(db);
  const gateway = await resolvePaymentGateway();

  const tenantTimezone = async (id: string): Promise<string> =>
    (await tenantRepo.findTenantById(id))?.defaultTimezone ?? "UTC";
  const availabilityService = new AvailabilityService(catalogRepo, hubRepo);
  const bookingService = new BookingService(paymentRepo, events);

  const deps: AppDeps = {
    platformBaseDomain: env.PLATFORM_BASE_DOMAIN,
    tenantLookup: tenantRepo.tenantLookup(),
    tenantAdmin: new TenantAdminService(tenantRepo, events),
    catalogService: new CatalogService(catalogRepo, events),
    locations: new LocationService(locationRepo, events),
    customers: new CustomerService(paymentRepo, events),
    resourceHub: new ResourceHubService(hubRepo, events),
    staffAuth: new StaffAuthService(staffRepo, events),
    availability: availabilityService,
    adminBookings: new AdminBookingService({
      availability: availabilityService,
      catalog: catalogRepo,
      hub: hubRepo,
      bookings: bookingService,
      reads: paymentRepo,
      occupancy: catalogRepo,
      tenantTimezone,
    }),
    tenantTimezone,
    checkout: {
      catalog: catalogRepo,
      hub: hubRepo,
      locks: new CheckoutLockService(new RedisLockStore(redis)),
      bookings: bookingService,
      carts: new CartReconciliationService(paymentRepo, gateway, events),
      webhooks: new WebhookProcessor(new DrizzleProcessedWebhookStore(db), events),
      occupancy: catalogRepo,
      holds: new DrizzleHoldStore(db),
    },
  };

  return {
    deps,
    host: env.API_HOST,
    port: env.API_PORT,
    mode: "persistent",
    // Migrations and tenant provisioning are operational steps, not boot-time.
    seed: () => Promise.resolve(),
    close: async () => {
      await redis.quit();
      await db.close();
    },
  };
}

/** Local dev stack: in-memory adapters seeded with the first demo tenant. */
async function inMemoryBootstrap(): Promise<Bootstrap> {
  const store = new InMemoryStore();
  const paymentStore = new InMemoryPaymentStore();
  const gateway = await resolvePaymentGateway();
  const events = new InMemoryEventSink();

  const tenantTimezone = async (id: string): Promise<string> =>
    (await store.findTenantById(id))?.defaultTimezone ?? "UTC";
  const availabilityService = new AvailabilityService(store, store);
  const bookingService = new BookingService(paymentStore, events);

  const deps: AppDeps = {
    platformBaseDomain: "localhost",
    tenantLookup: store.tenantLookup(),
    tenantAdmin: new TenantAdminService(store, events),
    catalogService: new CatalogService(store, events),
    locations: new LocationService(store, events),
    customers: new CustomerService(paymentStore, events),
    resourceHub: new ResourceHubService(store, events),
    staffAuth: new StaffAuthService(new InMemoryStaffAccountStore(), events),
    availability: availabilityService,
    adminBookings: new AdminBookingService({
      availability: availabilityService,
      catalog: store,
      hub: store,
      bookings: bookingService,
      reads: paymentStore,
      occupancy: store,
      tenantTimezone,
    }),
    tenantTimezone,
    checkout: {
      catalog: store,
      hub: store,
      locks: new CheckoutLockService(new InMemoryLockStore()),
      bookings: bookingService,
      carts: new CartReconciliationService(paymentStore, gateway, events),
      webhooks: new WebhookProcessor(new InMemoryProcessedWebhookStore(), events),
      occupancy: store,
    },
  };

  return {
    deps,
    host: "0.0.0.0",
    port: 3001,
    mode: "in-memory",
    seed: async () => {
      const demo = DEMO_TENANTS[0];
      if (demo === undefined) {
        return;
      }
      const seedTenant: Tenant = {
        id: demo.id,
        slug: demo.slug,
        displayName: demo.name,
        status: "active",
        defaultTimezone: "Europe/Madrid",
        defaultLocale: "es",
        branding: DEFAULT_BRANDING,
        policies: DEFAULT_POLICIES,
      };
      await store.insertTenant(seedTenant);
    },
    close: () => Promise.resolve(),
  };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const bootstrap =
  process.env.DATABASE_URL !== undefined ? await persistentBootstrap() : await inMemoryBootstrap();

const app = buildApp(bootstrap.deps);

// Platform-level operations dashboard feed (not tenant-scoped).
app.get("/v1/ops/tenants", async (_request, reply) => {
  await reply.send(TENANT_OVERVIEWS);
});

const shutdown = async (): Promise<void> => {
  await app.close();
  await bootstrap.close();
};
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

await bootstrap.seed();
await app.listen({ host: bootstrap.host, port: bootstrap.port });
console.log(
  `API server (${bootstrap.mode}) listening on ${bootstrap.host}:${String(bootstrap.port)}`,
);
