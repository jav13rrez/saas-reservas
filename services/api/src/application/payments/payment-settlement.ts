/**
 * PaymentSettlement adapter over the cart reconciliation service: booking
 * changes refund or re-point subpayments without knowing about carts.
 */

import type { Actor } from "@saas-reservas/domain/audit/events";
import { PaymentInvariantError } from "@saas-reservas/domain/payments/payment";
import type { PaymentSettlement } from "../bookings/booking-change-service.js";
import type { CartReconciliationService, CartRepository } from "./cart-reconciliation-service.js";

export class CartPaymentSettlement implements PaymentSettlement {
  constructor(
    private readonly carts: CartRepository,
    private readonly reconciliation: CartReconciliationService,
  ) {}

  async refundBooking(
    tenantId: string,
    bookingId: string,
    actor: Actor,
  ): Promise<"refunded" | "no-payment"> {
    const subPayment = await this.carts.findSubPaymentByBookingId(tenantId, bookingId);
    if (subPayment === null) {
      return "no-payment";
    }
    await this.reconciliation.refundBooking({ tenantId, bookingId, actor });
    return "refunded";
  }

  async reassignBooking(
    tenantId: string,
    fromBookingId: string,
    toBookingId: string,
  ): Promise<void> {
    const subPayment = await this.carts.findSubPaymentByBookingId(tenantId, fromBookingId);
    if (subPayment === null) {
      return; // unpaid booking: nothing to move
    }
    if (subPayment.refundedAmount > 0) {
      throw new PaymentInvariantError(
        `subpayment ${subPayment.id} has refunds; cannot reassign to ${toBookingId}`,
      );
    }
    await this.carts.updateSubPayment({ ...subPayment, bookingId: toBookingId });
  }
}
