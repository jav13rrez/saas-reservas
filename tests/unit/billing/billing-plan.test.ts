/**
 * T076 – Billing plan, feature flags, and quota domain logic tests.
 */

import { describe, it, expect } from "vitest";
import {
  hasFeature,
  isWithinQuota,
  bookingQuotaRemaining,
  PROFESSIONAL_PLAN,
  STARTER_PLAN,
  type TenantBilling,
} from "@saas-reservas/domain/billing/billing";

function makeBilling(overrides: Partial<TenantBilling> = {}): TenantBilling {
  return {
    tenantId: "t1",
    planId: PROFESSIONAL_PLAN.id,
    plan: PROFESSIONAL_PLAN,
    status: "active",
    currentPeriodStart: "2026-06-01",
    currentPeriodEnd: "2026-07-01",
    usage: {
      bookingsThisPeriod: 0,
      notificationsThisPeriod: 0,
      storageUsedBytes: 0,
    },
    ...overrides,
  };
}

describe("hasFeature", () => {
  it("returns true when plan includes the feature", () => {
    const billing = makeBilling();
    expect(hasFeature(billing, "calendar_sync")).toBe(true);
    expect(hasFeature(billing, "api_webhooks")).toBe(true);
  });

  it("returns false when plan does not include the feature", () => {
    const billing = makeBilling({ plan: STARTER_PLAN, planId: STARTER_PLAN.id });
    expect(hasFeature(billing, "calendar_sync")).toBe(false);
    expect(hasFeature(billing, "video_meetings")).toBe(false);
  });

  it("returns false when billing status is canceled", () => {
    const billing = makeBilling({ status: "canceled" });
    expect(hasFeature(billing, "calendar_sync")).toBe(false);
  });

  it("returns false when billing status is paused", () => {
    const billing = makeBilling({ status: "paused" });
    expect(hasFeature(billing, "api_webhooks")).toBe(false);
  });

  it("allows features on past_due (grace period)", () => {
    const billing = makeBilling({ status: "past_due" });
    expect(hasFeature(billing, "calendar_sync")).toBe(true);
  });
});

describe("isWithinQuota", () => {
  it("returns true when usage is below quota", () => {
    const billing = makeBilling();
    expect(isWithinQuota(billing, "bookingsPerMonth", 100)).toBe(true);
  });

  it("returns false when usage equals quota limit", () => {
    const billing = makeBilling();
    expect(
      isWithinQuota(billing, "bookingsPerMonth", PROFESSIONAL_PLAN.quotas.bookingsPerMonth),
    ).toBe(false);
  });

  it("returns false when billing is canceled regardless of usage", () => {
    const billing = makeBilling({ status: "canceled" });
    expect(isWithinQuota(billing, "bookingsPerMonth", 0)).toBe(false);
  });
});

describe("bookingQuotaRemaining", () => {
  it("returns full quota at start of period", () => {
    const billing = makeBilling();
    expect(bookingQuotaRemaining(billing)).toBe(PROFESSIONAL_PLAN.quotas.bookingsPerMonth);
  });

  it("decreases as bookings are consumed", () => {
    const billing = makeBilling({
      usage: { bookingsThisPeriod: 500, notificationsThisPeriod: 0, storageUsedBytes: 0 },
    });
    expect(bookingQuotaRemaining(billing)).toBe(PROFESSIONAL_PLAN.quotas.bookingsPerMonth - 500);
  });

  it("never returns negative", () => {
    const billing = makeBilling({
      usage: {
        bookingsThisPeriod: PROFESSIONAL_PLAN.quotas.bookingsPerMonth + 100,
        notificationsThisPeriod: 0,
        storageUsedBytes: 0,
      },
    });
    expect(bookingQuotaRemaining(billing)).toBe(0);
  });
});
