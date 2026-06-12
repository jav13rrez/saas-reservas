/**
 * Payment aggregate: packages, coupons, cart parent transactions, and
 * per-booking subpayments (T033).
 *
 * A cart checkout produces one CartTransaction at the gateway plus one
 * SubPayment per booking, so canceling a single booking inside a cart can be
 * refunded exactly (plan.md "Payments"). All amounts are integer minor units.
 */

export interface ServicePackage {
  id: string;
  tenantId: string;
  name: string;
  /** Services the package can cover. */
  serviceIds: string[];
  /** Discount applied to covered bookings, in percent (0-100). */
  discountPercent: number;
  status: "active" | "inactive";
}

export interface Coupon {
  id: string;
  tenantId: string;
  code: string;
  kind: "percent" | "fixed";
  /** Percent 0-100 for "percent"; minor units for "fixed". */
  value: number;
  status: "active" | "inactive";
  /** Restricts the coupon to specific services when present. */
  appliesToServiceIds?: string[];
}

export type CartTransactionStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "partially-refunded"
  | "refunded"
  | "failed";

export interface CartTransaction {
  id: string;
  tenantId: string;
  customerId: string;
  gateway: string;
  gatewayTransactionId?: string;
  status: CartTransactionStatus;
  totalAmount: number;
  currency: string;
}

export type SubPaymentStatus = "pending" | "captured" | "partially-refunded" | "refunded";

/** Allocation of a cart transaction to one booking. */
export interface SubPayment {
  id: string;
  tenantId: string;
  cartTransactionId: string;
  bookingId: string;
  amount: number;
  refundedAmount: number;
  status: SubPaymentStatus;
}

export class PaymentInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentInvariantError";
  }
}

/** Every booking in a cart must have a reconcilable subpayment allocation. */
export function assertCartIsReconcilable(cart: CartTransaction, subPayments: SubPayment[]): void {
  const allocated = subPayments
    .filter((subPayment) => subPayment.cartTransactionId === cart.id)
    .reduce((sum, subPayment) => sum + subPayment.amount, 0);
  if (allocated !== cart.totalAmount) {
    throw new PaymentInvariantError(
      `cart ${cart.id} allocates ${String(allocated)} but charged ${String(cart.totalAmount)}`,
    );
  }
}

/** Cart status derived from its subpayments after refunds. */
export function deriveCartStatus(
  cart: CartTransaction,
  subPayments: SubPayment[],
): CartTransactionStatus {
  if (cart.status === "pending" || cart.status === "authorized" || cart.status === "failed") {
    return cart.status;
  }
  const own = subPayments.filter((subPayment) => subPayment.cartTransactionId === cart.id);
  const refunded = own.reduce((sum, subPayment) => sum + subPayment.refundedAmount, 0);
  if (refunded === 0) {
    return "captured";
  }
  return refunded >= cart.totalAmount ? "refunded" : "partially-refunded";
}
