/**
 * Demo tenant seeds (T079).
 *
 * Creates three representative tenants (Starter, Professional, Enterprise)
 * with providers, services, and sample bookings for local dev and CI smoke
 * tests. All data is deterministic — the same seed produces the same IDs
 * so idempotent re-runs are safe.
 */

import {
  STARTER_PLAN,
  PROFESSIONAL_PLAN,
  ENTERPRISE_PLAN,
} from "@saas-reservas/domain/billing/billing";
import type { BillingPlan } from "@saas-reservas/domain/billing/billing";

// ---------------------------------------------------------------------------
// Seed schema (minimal, framework-agnostic)
// ---------------------------------------------------------------------------

export interface DemoProvider {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  timezone: string;
}

export interface DemoService {
  id: string;
  tenantId: string;
  providerId: string;
  name: string;
  durationMinutes: number;
  priceAmount: number;
  currency: string;
}

export interface DemoBooking {
  id: string;
  tenantId: string;
  serviceId: string;
  providerId: string;
  customerEmail: string;
  customerName: string;
  startAt: string;
  endAt: string;
  status: "confirmed" | "cancelled" | "pending";
}

export interface DemoTenant {
  id: string;
  name: string;
  slug: string;
  plan: BillingPlan;
  providers: DemoProvider[];
  services: DemoService[];
  bookings: DemoBooking[];
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

export const DEMO_TENANTS: DemoTenant[] = [
  {
    id: "demo-tenant-starter",
    name: "Beauty Studio Starter",
    slug: "beauty-starter",
    plan: STARTER_PLAN,
    providers: [
      {
        id: "demo-prov-starter-1",
        tenantId: "demo-tenant-starter",
        name: "Ana García",
        email: "ana@beauty-starter.example",
        timezone: "Europe/Madrid",
      },
    ],
    services: [
      {
        id: "demo-svc-starter-1",
        tenantId: "demo-tenant-starter",
        providerId: "demo-prov-starter-1",
        name: "Haircut",
        durationMinutes: 45,
        priceAmount: 3500,
        currency: "EUR",
      },
      {
        id: "demo-svc-starter-2",
        tenantId: "demo-tenant-starter",
        providerId: "demo-prov-starter-1",
        name: "Colour Treatment",
        durationMinutes: 120,
        priceAmount: 8000,
        currency: "EUR",
      },
    ],
    bookings: [
      {
        id: "demo-bk-starter-1",
        tenantId: "demo-tenant-starter",
        serviceId: "demo-svc-starter-1",
        providerId: "demo-prov-starter-1",
        customerEmail: "customer1@example.com",
        customerName: "Carlos López",
        startAt: "2026-06-20T10:00:00+02:00",
        endAt: "2026-06-20T10:45:00+02:00",
        status: "confirmed",
      },
    ],
  },
  {
    id: "demo-tenant-professional",
    name: "Wellness Clinic Pro",
    slug: "wellness-pro",
    plan: PROFESSIONAL_PLAN,
    providers: [
      {
        id: "demo-prov-pro-1",
        tenantId: "demo-tenant-professional",
        name: "Dr. María Torres",
        email: "maria@wellness-pro.example",
        timezone: "Europe/Madrid",
      },
      {
        id: "demo-prov-pro-2",
        tenantId: "demo-tenant-professional",
        name: "Dr. Jaume Puig",
        email: "jaume@wellness-pro.example",
        timezone: "Europe/Madrid",
      },
    ],
    services: [
      {
        id: "demo-svc-pro-1",
        tenantId: "demo-tenant-professional",
        providerId: "demo-prov-pro-1",
        name: "Initial Consultation",
        durationMinutes: 60,
        priceAmount: 12000,
        currency: "EUR",
      },
      {
        id: "demo-svc-pro-2",
        tenantId: "demo-tenant-professional",
        providerId: "demo-prov-pro-1",
        name: "Follow-up",
        durationMinutes: 30,
        priceAmount: 7000,
        currency: "EUR",
      },
      {
        id: "demo-svc-pro-3",
        tenantId: "demo-tenant-professional",
        providerId: "demo-prov-pro-2",
        name: "Physio Session",
        durationMinutes: 45,
        priceAmount: 9500,
        currency: "EUR",
      },
    ],
    bookings: [
      {
        id: "demo-bk-pro-1",
        tenantId: "demo-tenant-professional",
        serviceId: "demo-svc-pro-1",
        providerId: "demo-prov-pro-1",
        customerEmail: "patient1@example.com",
        customerName: "Laura Fernández",
        startAt: "2026-06-20T09:00:00+02:00",
        endAt: "2026-06-20T10:00:00+02:00",
        status: "confirmed",
      },
      {
        id: "demo-bk-pro-2",
        tenantId: "demo-tenant-professional",
        serviceId: "demo-svc-pro-3",
        providerId: "demo-prov-pro-2",
        customerEmail: "patient2@example.com",
        customerName: "Miquel Serra",
        startAt: "2026-06-20T11:00:00+02:00",
        endAt: "2026-06-20T11:45:00+02:00",
        status: "pending",
      },
    ],
  },
  {
    id: "demo-tenant-enterprise",
    name: "Corporate Events Enterprise",
    slug: "corp-enterprise",
    plan: ENTERPRISE_PLAN,
    providers: [
      {
        id: "demo-prov-ent-1",
        tenantId: "demo-tenant-enterprise",
        name: "Sales Team",
        email: "sales@corp-enterprise.example",
        timezone: "Europe/Madrid",
      },
      {
        id: "demo-prov-ent-2",
        tenantId: "demo-tenant-enterprise",
        name: "Support Team",
        email: "support@corp-enterprise.example",
        timezone: "Europe/Madrid",
      },
      {
        id: "demo-prov-ent-3",
        tenantId: "demo-tenant-enterprise",
        name: "Executive Team",
        email: "exec@corp-enterprise.example",
        timezone: "Europe/Madrid",
      },
    ],
    services: [
      {
        id: "demo-svc-ent-1",
        tenantId: "demo-tenant-enterprise",
        providerId: "demo-prov-ent-1",
        name: "Product Demo",
        durationMinutes: 60,
        priceAmount: 0,
        currency: "EUR",
      },
      {
        id: "demo-svc-ent-2",
        tenantId: "demo-tenant-enterprise",
        providerId: "demo-prov-ent-2",
        name: "Onboarding Call",
        durationMinutes: 90,
        priceAmount: 0,
        currency: "EUR",
      },
      {
        id: "demo-svc-ent-3",
        tenantId: "demo-tenant-enterprise",
        providerId: "demo-prov-ent-3",
        name: "Executive Briefing",
        durationMinutes: 45,
        priceAmount: 0,
        currency: "EUR",
      },
    ],
    bookings: [
      {
        id: "demo-bk-ent-1",
        tenantId: "demo-tenant-enterprise",
        serviceId: "demo-svc-ent-1",
        providerId: "demo-prov-ent-1",
        customerEmail: "prospect@bigcorp.example",
        customerName: "James Wilson",
        startAt: "2026-06-21T14:00:00+02:00",
        endAt: "2026-06-21T15:00:00+02:00",
        status: "confirmed",
      },
      {
        id: "demo-bk-ent-2",
        tenantId: "demo-tenant-enterprise",
        serviceId: "demo-svc-ent-2",
        providerId: "demo-prov-ent-2",
        customerEmail: "newclient@startup.example",
        customerName: "Sophie Martin",
        startAt: "2026-06-22T10:00:00+02:00",
        endAt: "2026-06-22T11:30:00+02:00",
        status: "confirmed",
      },
      {
        id: "demo-bk-ent-3",
        tenantId: "demo-tenant-enterprise",
        serviceId: "demo-svc-ent-3",
        providerId: "demo-prov-ent-3",
        customerEmail: "cto@enterprise.example",
        customerName: "Alex Johnson",
        startAt: "2026-06-23T16:00:00+02:00",
        endAt: "2026-06-23T16:45:00+02:00",
        status: "cancelled",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

export interface SeedStore {
  upsertTenant(id: string, name: string, slug: string, planId: string): Promise<void>;
  upsertProvider(provider: DemoProvider): Promise<void>;
  upsertService(service: DemoService): Promise<void>;
  upsertBooking(booking: DemoBooking): Promise<void>;
}

export async function runDemoSeeds(store: SeedStore): Promise<void> {
  for (const tenant of DEMO_TENANTS) {
    await store.upsertTenant(tenant.id, tenant.name, tenant.slug, tenant.plan.id);
    for (const provider of tenant.providers) {
      await store.upsertProvider(provider);
    }
    for (const service of tenant.services) {
      await store.upsertService(service);
    }
    for (const booking of tenant.bookings) {
      await store.upsertBooking(booking);
    }
  }
}
