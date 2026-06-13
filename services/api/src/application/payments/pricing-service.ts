/**
 * Pricing service (T036): price = service base x attendees + extras
 * (optionally multiplied by attendees) - package/coupon discounts + taxes,
 * with deposit support (spec US2 scenario 1). Pure function over domain data;
 * all amounts are integer minor units, percent math rounds half-up per step.
 */

import type { Extra, Service } from "@saas-reservas/domain/catalog/service";
import {
  PaymentInvariantError,
  type Coupon,
  type ServicePackage,
} from "@saas-reservas/domain/payments/payment";

export interface PricedExtra {
  extra: Extra;
  quantity: number;
}

export interface DepositPolicy {
  kind: "percent" | "fixed";
  value: number;
}

export interface PricingInput {
  service: Service;
  extras: PricedExtra[];
  attendees: number;
  coupon?: Coupon;
  servicePackage?: ServicePackage;
  /** e.g. 21 for 21% VAT, applied after discounts. */
  taxRatePercent?: number;
  deposit?: DepositPolicy;
}

export interface PriceBreakdown {
  baseAmount: number;
  extrasAmount: number;
  subtotalAmount: number;
  packageDiscountAmount: number;
  couponDiscountAmount: number;
  taxAmount: number;
  totalAmount: number;
  /** What the customer must pay at checkout (deposit, or the full total). */
  dueNowAmount: number;
}

function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

export function priceBooking(input: PricingInput): PriceBreakdown {
  const { service, attendees } = input;
  if (!Number.isInteger(attendees) || attendees < 1) {
    throw new PaymentInvariantError("attendees must be a positive integer");
  }

  const baseAmount = service.priceAmount * attendees;
  const extrasAmount = input.extras.reduce((sum, { extra, quantity }) => {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new PaymentInvariantError(`extra ${extra.id} quantity must be a positive integer`);
    }
    const people = extra.multiplyByPeople ? attendees : 1;
    return sum + extra.priceAmount * quantity * people;
  }, 0);
  const subtotalAmount = baseAmount + extrasAmount;

  let packageDiscountAmount = 0;
  const pkg = input.servicePackage;
  if (pkg?.status === "active" && pkg.serviceIds.includes(service.id)) {
    packageDiscountAmount = percentOf(subtotalAmount, pkg.discountPercent);
  }

  let couponDiscountAmount = 0;
  const coupon = input.coupon;
  const couponApplies =
    coupon?.status === "active" &&
    (coupon.appliesToServiceIds === undefined || coupon.appliesToServiceIds.includes(service.id));
  if (couponApplies) {
    const discountable = subtotalAmount - packageDiscountAmount;
    couponDiscountAmount =
      coupon.kind === "percent"
        ? percentOf(discountable, coupon.value)
        : Math.min(coupon.value, discountable);
  }

  const discountedAmount = subtotalAmount - packageDiscountAmount - couponDiscountAmount;
  const taxAmount = percentOf(discountedAmount, input.taxRatePercent ?? 0);
  const totalAmount = discountedAmount + taxAmount;

  let dueNowAmount = totalAmount;
  if (input.deposit !== undefined) {
    const deposit =
      input.deposit.kind === "percent"
        ? percentOf(totalAmount, input.deposit.value)
        : input.deposit.value;
    dueNowAmount = Math.min(Math.max(deposit, 0), totalAmount);
  }

  return {
    baseAmount,
    extrasAmount,
    subtotalAmount,
    packageDiscountAmount,
    couponDiscountAmount,
    taxAmount,
    totalAmount,
    dueNowAmount,
  };
}
