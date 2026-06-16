import { NextResponse } from "next/server";

/**
 * GET /api/ops/tenants
 *
 * Returns a TenantOverview array for all demo tenants.
 * This Next.js route takes priority over the Fastify rewrite so the admin app
 * works without the API server running.
 */

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

const MB = 1024 * 1024;
const GB = 1024 * MB;

const TENANTS: TenantOverview[] = [
  {
    tenantId: "demo-tenant-starter",
    tenantName: "Beauty Studio Starter",
    planName: "Starter",
    billingStatus: "trialing",
    // 1 booking * 30
    bookingsThisPeriod: 30,
    bookingsQuota: 200,
    storageUsedBytes: Math.round(100 * MB * 0.18),
    storageQuotaBytes: 100 * MB,
    notificationsThisPeriod: Math.round(500 * 0.12),
    notificationsQuota: 500,
  },
  {
    tenantId: "demo-tenant-professional",
    tenantName: "Wellness Clinic Pro",
    planName: "Professional",
    billingStatus: "active",
    // 2 bookings * 30
    bookingsThisPeriod: 60,
    bookingsQuota: 2000,
    storageUsedBytes: Math.round(2 * GB * 0.18),
    storageQuotaBytes: 2 * GB,
    notificationsThisPeriod: Math.round(5000 * 0.12),
    notificationsQuota: 5000,
  },
  {
    tenantId: "demo-tenant-enterprise",
    tenantName: "Corporate Events Enterprise",
    planName: "Enterprise",
    billingStatus: "active",
    // 3 bookings * 30
    bookingsThisPeriod: 90,
    bookingsQuota: 999_999,
    storageUsedBytes: Math.round(50 * GB * 0.18),
    storageQuotaBytes: 50 * GB,
    notificationsThisPeriod: Math.round(999_999 * 0.12),
    notificationsQuota: 999_999,
  },
];

export function GET(): NextResponse<TenantOverview[]> {
  return NextResponse.json(TENANTS);
}
