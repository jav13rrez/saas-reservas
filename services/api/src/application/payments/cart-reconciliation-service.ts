/**
 * Cart reconciliation service (T039): one gateway charge per cart, one
 * subpayment per booking, so canceling a single booking refunds exactly its
 * allocation (spec US2 scenario 2).
 */

import { randomUUID } from "node:crypto";
import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import {
  assertCartIsReconcilable,
  deriveCartStatus,
  PaymentInvariantError,
  type CartTransaction,
  type SubPayment,
} from "@saas-reservas/domain/payments/payment";
import type { PaymentGateway } from "@saas-reservas/integrations/payments/payment-gateway";
import type { EventSink } from "../events.js";

export interface CartRepository {
  insertCart(cart: CartTransaction): Promise<void>;
  updateCart(cart: CartTransaction): Promise<void>;
  findCartById(tenantId: string, cartId: string): Promise<CartTransaction | null>;
  insertSubPayment(subPayment: SubPayment): Promise<void>;
  updateSubPayment(subPayment: SubPayment): Promise<void>;
  listSubPayments(tenantId: string, cartId: string): Promise<SubPayment[]>;
  findSubPaymentByBookingId(tenantId: string, bookingId: string): Promise<SubPayment | null>;
}

export interface CartAllocation {
  bookingId: string;
  amount: number;
}

export class CartReconciliationService {
  constructor(
    private readonly carts: CartRepository,
    private readonly gateway: PaymentGateway,
    private readonly events: EventSink,
  ) {}

  /** Creates the pending parent transaction plus one subpayment per booking. */
  async createCart(input: {
    tenantId: string;
    customerId: string;
    currency: string;
    allocations: CartAllocation[];
    actor: Actor;
  }): Promise<{ cart: CartTransaction; subPayments: SubPayment[] }> {
    if (input.allocations.length === 0) {
      throw new PaymentInvariantError("a cart needs at least one booking allocation");
    }
    const cart: CartTransaction = {
      id: randomUUID(),
      tenantId: input.tenantId,
      customerId: input.customerId,
      gateway: this.gateway.name,
      status: "pending",
      totalAmount: input.allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      currency: input.currency,
    };
    const subPayments: SubPayment[] = input.allocations.map((allocation) => ({
      id: randomUUID(),
      tenantId: input.tenantId,
      cartTransactionId: cart.id,
      bookingId: allocation.bookingId,
      amount: allocation.amount,
      refundedAmount: 0,
      status: "pending",
    }));
    assertCartIsReconcilable(cart, subPayments);

    await this.carts.insertCart(cart);
    for (const subPayment of subPayments) {
      await this.carts.insertSubPayment(subPayment);
    }
    await this.audit(
      input.tenantId,
      input.actor,
      "payment.cart-created",
      "cart-transaction",
      cart.id,
      {
        totalAmount: cart.totalAmount,
        bookings: subPayments.length,
      },
    );
    return { cart, subPayments };
  }

  /** Charges the gateway for the full cart; on success marks everything captured. */
  async chargeCart(input: {
    tenantId: string;
    cartId: string;
    actor: Actor;
    /** Tokenized funding source (e.g. Stripe PaymentMethod id) for synchronous confirmation. */
    paymentMethod?: string;
  }): Promise<CartTransaction> {
    const cart = await this.requireCart(input.tenantId, input.cartId);
    if (cart.status !== "pending") {
      throw new PaymentInvariantError(`cart ${cart.id} is not chargeable from ${cart.status}`);
    }
    const result = await this.gateway.createCharge({
      tenantId: cart.tenantId,
      amount: cart.totalAmount,
      currency: cart.currency,
      idempotencyKey: `cart:${cart.id}`,
      description: `Cart ${cart.id}`,
      // cartId rides on the gateway charge so an async payment webhook can map
      // back to this cart and settle the booking (checkout-routes stripe-webhook).
      metadata: { cartId: cart.id, tenantId: cart.tenantId },
      ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
    });
    if (!result.ok) {
      const failed: CartTransaction = { ...cart, status: "failed" };
      await this.carts.updateCart(failed);
      await this.audit(
        cart.tenantId,
        input.actor,
        "payment.charge-failed",
        "cart-transaction",
        cart.id,
        {
          reason: result.reason,
        },
      );
      return failed;
    }
    const captured: CartTransaction = {
      ...cart,
      status: "captured",
      gatewayTransactionId: result.chargeId,
    };
    await this.carts.updateCart(captured);
    for (const subPayment of await this.carts.listSubPayments(cart.tenantId, cart.id)) {
      await this.carts.updateSubPayment({ ...subPayment, status: "captured" });
    }
    await this.audit(cart.tenantId, input.actor, "payment.captured", "cart-transaction", cart.id, {
      gatewayTransactionId: result.chargeId,
    });
    return captured;
  }

  /** Refunds exactly one booking's remaining subpayment allocation. */
  async refundBooking(input: {
    tenantId: string;
    bookingId: string;
    actor: Actor;
  }): Promise<SubPayment> {
    const subPayment = await this.carts.findSubPaymentByBookingId(input.tenantId, input.bookingId);
    if (subPayment === null) {
      throw new PaymentInvariantError(`no subpayment for booking ${input.bookingId}`);
    }
    const cart = await this.requireCart(input.tenantId, subPayment.cartTransactionId);
    if (cart.gatewayTransactionId === undefined) {
      throw new PaymentInvariantError(`cart ${cart.id} was never charged`);
    }
    const remaining = subPayment.amount - subPayment.refundedAmount;
    if (remaining <= 0) {
      throw new PaymentInvariantError(`subpayment ${subPayment.id} is already fully refunded`);
    }

    const result = await this.gateway.refund({
      tenantId: cart.tenantId,
      chargeId: cart.gatewayTransactionId,
      amount: remaining,
    });
    if (!result.ok) {
      throw new PaymentInvariantError(`gateway refund failed: ${result.reason}`);
    }

    const refunded: SubPayment = {
      ...subPayment,
      refundedAmount: subPayment.amount,
      status: "refunded",
    };
    await this.carts.updateSubPayment(refunded);

    const subPayments = await this.carts.listSubPayments(cart.tenantId, cart.id);
    const newStatus = deriveCartStatus(cart, subPayments);
    if (newStatus !== cart.status) {
      await this.carts.updateCart({ ...cart, status: newStatus });
    }
    await this.audit(cart.tenantId, input.actor, "payment.refunded", "sub-payment", subPayment.id, {
      bookingId: input.bookingId,
      amount: remaining,
      cartStatus: newStatus,
    });
    return refunded;
  }

  private async requireCart(tenantId: string, cartId: string): Promise<CartTransaction> {
    const cart = await this.carts.findCartById(tenantId, cartId);
    if (cart === null) {
      throw new PaymentInvariantError(`cart ${cartId} not found`);
    }
    return cart;
  }

  private async audit(
    tenantId: string,
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const event = createDomainEvent({ tenantId, type: action, actor, payload: { entityId } });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action,
        entityType,
        entityId,
        ...(metadata ? { metadata } : {}),
      }),
    );
  }
}
