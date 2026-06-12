/**
 * T028: pricing with attendees, extras, coupons, deposits, taxes, and packages.
 * Amounts are integer minor units (cents).
 */

import { describe, expect, it } from "vitest";
import type { Extra, Service } from "@saas-reservas/domain/catalog/service";
import type { Coupon, ServicePackage } from "@saas-reservas/domain/payments/payment";
import { priceBooking } from "@saas-reservas/api/application/payments/pricing-service";

const TENANT = "00000000-0000-4000-8000-000000000001";

const service: Service = {
  id: "svc-1",
  tenantId: TENANT,
  categoryId: "cat-1",
  name: "Session",
  durationMinutes: 60,
  priceAmount: 5000, // 50.00
  currency: "EUR",
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minCapacity: 1,
  maxCapacity: 10,
  status: "active",
};

const perPersonExtra: Extra = {
  id: "extra-pp",
  tenantId: TENANT,
  serviceId: service.id,
  name: "Equipment",
  durationMinutes: 0,
  priceAmount: 500, // 5.00 per person
  multiplyByPeople: true,
  status: "active",
};

const flatExtra: Extra = {
  id: "extra-flat",
  tenantId: TENANT,
  serviceId: service.id,
  name: "Room upgrade",
  durationMinutes: 0,
  priceAmount: 1500, // 15.00 flat
  multiplyByPeople: false,
  status: "active",
};

const coupon = (overrides: Partial<Coupon>): Coupon => ({
  id: "coupon-1",
  tenantId: TENANT,
  code: "SAVE",
  kind: "percent",
  value: 10,
  status: "active",
  ...overrides,
});

describe("priceBooking", () => {
  it("multiplies base price by attendees and extras by quantity and people", () => {
    const breakdown = priceBooking({
      service,
      attendees: 3,
      extras: [
        { extra: perPersonExtra, quantity: 1 }, // 500 * 3 = 1500
        { extra: flatExtra, quantity: 2 }, // 1500 * 2 = 3000
      ],
    });
    expect(breakdown.baseAmount).toBe(15000);
    expect(breakdown.extrasAmount).toBe(4500);
    expect(breakdown.subtotalAmount).toBe(19500);
    expect(breakdown.totalAmount).toBe(19500);
    expect(breakdown.dueNowAmount).toBe(19500);
  });

  it("applies package discount, then coupon, then tax", () => {
    const pkg: ServicePackage = {
      id: "pkg-1",
      tenantId: TENANT,
      name: "Wellness pack",
      serviceIds: [service.id],
      discountPercent: 20,
      status: "active",
    };
    const breakdown = priceBooking({
      service,
      attendees: 2, // base 10000
      extras: [],
      servicePackage: pkg, // -2000
      coupon: coupon({ kind: "fixed", value: 1000 }), // -1000 on 8000
      taxRatePercent: 21, // 21% of 7000 = 1470
    });
    expect(breakdown.packageDiscountAmount).toBe(2000);
    expect(breakdown.couponDiscountAmount).toBe(1000);
    expect(breakdown.taxAmount).toBe(1470);
    expect(breakdown.totalAmount).toBe(8470);
  });

  it("ignores inactive coupons and coupons restricted to other services", () => {
    const inactive = priceBooking({
      service,
      attendees: 1,
      extras: [],
      coupon: coupon({ status: "inactive" }),
    });
    expect(inactive.couponDiscountAmount).toBe(0);

    const otherService = priceBooking({
      service,
      attendees: 1,
      extras: [],
      coupon: coupon({ appliesToServiceIds: ["svc-other"] }),
    });
    expect(otherService.couponDiscountAmount).toBe(0);
  });

  it("clamps fixed coupons to the discountable amount", () => {
    const breakdown = priceBooking({
      service,
      attendees: 1, // 5000
      extras: [],
      coupon: coupon({ kind: "fixed", value: 99999 }),
    });
    expect(breakdown.couponDiscountAmount).toBe(5000);
    expect(breakdown.totalAmount).toBe(0);
  });

  it("computes percent and fixed deposits as the amount due now", () => {
    const percentDeposit = priceBooking({
      service,
      attendees: 2, // 10000
      extras: [],
      deposit: { kind: "percent", value: 30 },
    });
    expect(percentDeposit.totalAmount).toBe(10000);
    expect(percentDeposit.dueNowAmount).toBe(3000);

    const fixedDeposit = priceBooking({
      service,
      attendees: 1, // 5000
      extras: [],
      deposit: { kind: "fixed", value: 8000 }, // clamped to total
    });
    expect(fixedDeposit.dueNowAmount).toBe(5000);
  });

  it("rejects non-positive attendees and extra quantities", () => {
    expect(() => priceBooking({ service, attendees: 0, extras: [] })).toThrow();
    expect(() =>
      priceBooking({ service, attendees: 1, extras: [{ extra: flatExtra, quantity: 0 }] }),
    ).toThrow();
  });
});
