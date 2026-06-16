/**
 * Tenant billing plan, feature flags, quota, and usage event model (T076).
 *
 * BillingPlan drives what each tenant can do (feature flags) and how much
 * (quota). UsageEvent records consumption for metering and quota enforcement.
 * All entities are platform-global except TenantBilling, which is scoped to
 * a tenant but managed by platform operators.
 */

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export type FeatureFlag =
  | "calendar_sync"
  | "whatsapp_notifications"
  | "stripe_connect"
  | "video_meetings"
  | "custom_domain"
  | "api_webhooks"
  | "gdpr_export"
  | "advanced_reporting"
  | "multi_provider"
  | "event_tickets";

// ---------------------------------------------------------------------------
// Billing plan
// ---------------------------------------------------------------------------

export interface BillingPlan {
  id: string;
  name: string;
  /** Monthly price in integer minor units (e.g. 4900 = €49.00). */
  monthlyPriceAmount: number;
  currency: string;
  features: FeatureFlag[];
  quotas: BillingQuotas;
  isActive: boolean;
}

export interface BillingQuotas {
  /** Max bookings per calendar month across all providers. */
  bookingsPerMonth: number;
  /** Max active providers. */
  providers: number;
  /** Max active services. */
  services: number;
  /** Attachment storage in bytes. */
  storageBytes: number;
  /** Max outbound webhook subscriptions. */
  webhookSubscriptions: number;
  /** Max SMS/email notifications per month. */
  notificationsPerMonth: number;
}

// ---------------------------------------------------------------------------
// Tenant billing
// ---------------------------------------------------------------------------

export type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";

export interface TenantBilling {
  tenantId: string;
  planId: string;
  plan: BillingPlan;
  status: BillingStatus;
  /** ISO date string */
  currentPeriodStart: string;
  /** ISO date string */
  currentPeriodEnd: string;
  /** External subscription id (Stripe etc.) */
  externalSubscriptionId?: string | undefined;
  usage: TenantUsage;
}

export interface TenantUsage {
  bookingsThisPeriod: number;
  notificationsThisPeriod: number;
  storageUsedBytes: number;
}

// ---------------------------------------------------------------------------
// Usage events
// ---------------------------------------------------------------------------

export type UsageEventType =
  | "booking.created"
  | "notification.sent"
  | "attachment.uploaded"
  | "webhook.dispatched"
  | "api.request";

export interface UsageEvent {
  id: string;
  tenantId: string;
  type: UsageEventType;
  occurredAt: string;
  quantity: number;
  meta?: Record<string, string> | undefined;
}

// ---------------------------------------------------------------------------
// Domain logic
// ---------------------------------------------------------------------------

export function hasFeature(billing: TenantBilling, flag: FeatureFlag): boolean {
  if (billing.status === "canceled" || billing.status === "paused") return false;
  return billing.plan.features.includes(flag);
}

export function isWithinQuota(
  billing: TenantBilling,
  resource: keyof BillingQuotas,
  currentUsage: number,
): boolean {
  if (billing.status === "canceled") return false;
  const limit = billing.plan.quotas[resource];
  return currentUsage < limit;
}

export function bookingQuotaRemaining(billing: TenantBilling): number {
  return Math.max(0, billing.plan.quotas.bookingsPerMonth - billing.usage.bookingsThisPeriod);
}

// ---------------------------------------------------------------------------
// Built-in plans
// ---------------------------------------------------------------------------

export const STARTER_PLAN: BillingPlan = {
  id: "plan_starter",
  name: "Starter",
  monthlyPriceAmount: 2900,
  currency: "EUR",
  features: ["gdpr_export", "multi_provider"],
  quotas: {
    bookingsPerMonth: 200,
    providers: 3,
    services: 10,
    storageBytes: 100 * 1024 * 1024,
    webhookSubscriptions: 0,
    notificationsPerMonth: 500,
  },
  isActive: true,
};

export const PROFESSIONAL_PLAN: BillingPlan = {
  id: "plan_professional",
  name: "Professional",
  monthlyPriceAmount: 7900,
  currency: "EUR",
  features: [
    "calendar_sync",
    "whatsapp_notifications",
    "stripe_connect",
    "custom_domain",
    "api_webhooks",
    "gdpr_export",
    "multi_provider",
    "event_tickets",
  ],
  quotas: {
    bookingsPerMonth: 2000,
    providers: 20,
    services: 100,
    storageBytes: 2 * 1024 * 1024 * 1024,
    webhookSubscriptions: 10,
    notificationsPerMonth: 5000,
  },
  isActive: true,
};

export const ENTERPRISE_PLAN: BillingPlan = {
  id: "plan_enterprise",
  name: "Enterprise",
  monthlyPriceAmount: 29900,
  currency: "EUR",
  features: [
    "calendar_sync",
    "whatsapp_notifications",
    "stripe_connect",
    "video_meetings",
    "custom_domain",
    "api_webhooks",
    "gdpr_export",
    "advanced_reporting",
    "multi_provider",
    "event_tickets",
  ],
  quotas: {
    bookingsPerMonth: 999_999,
    providers: 999,
    services: 999,
    storageBytes: 50 * 1024 * 1024 * 1024,
    webhookSubscriptions: 100,
    notificationsPerMonth: 999_999,
  },
  isActive: true,
};

export const ALL_PLANS: BillingPlan[] = [STARTER_PLAN, PROFESSIONAL_PLAN, ENTERPRISE_PLAN];
