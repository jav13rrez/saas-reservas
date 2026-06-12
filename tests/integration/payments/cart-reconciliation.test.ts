/**
 * T031: cart parent transaction + per-booking subpayments (spec US2 scenario 2):
 * one gateway charge covers the cart; canceling one booking refunds only its
 * subpayment; webhook processing stays idempotent.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";
import {
  assertCartIsReconcilable,
  PaymentInvariantError,
} from "@saas-reservas/domain/payments/payment";
import { FakePaymentGateway } from "@saas-reservas/integrations/payments/payment-gateway";
import { CartReconciliationService } from "@saas-reservas/api/application/payments/cart-reconciliation-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { InMemoryPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-payment-store";
import {
  InMemoryProcessedWebhookStore,
  WebhookProcessor,
} from "@saas-reservas/api/infrastructure/payments/payment-webhooks";

const TENANT = "00000000-0000-4000-8000-000000000001";
const actor = SYSTEM_ACTOR;

describe("cart reconciliation", () => {
  let store: InMemoryPaymentStore;
  let gateway: FakePaymentGateway;
  let events: InMemoryEventSink;
  let service: CartReconciliationService;

  beforeEach(() => {
    store = new InMemoryPaymentStore();
    gateway = new FakePaymentGateway();
    events = new InMemoryEventSink();
    service = new CartReconciliationService(store, gateway, events);
  });

  async function capturedCartWithTwoBookings() {
    const { cart } = await service.createCart({
      tenantId: TENANT,
      customerId: "cus-1",
      currency: "EUR",
      allocations: [
        { bookingId: "bk-1", amount: 3000 },
        { bookingId: "bk-2", amount: 7000 },
      ],
      actor,
    });
    await service.chargeCart({ tenantId: TENANT, cartId: cart.id, actor });
    return cart;
  }

  it("charges one parent transaction allocated exactly across subpayments", async () => {
    const cart = await capturedCartWithTwoBookings();
    expect(gateway.charges).toHaveLength(1);
    expect(gateway.charges[0]?.request.amount).toBe(10000);

    const stored = await store.findCartById(TENANT, cart.id);
    expect(stored?.status).toBe("captured");
    const subPayments = await store.listSubPayments(TENANT, cart.id);
    expect(subPayments.map((subPayment) => subPayment.status)).toEqual(["captured", "captured"]);
    if (stored !== null) {
      assertCartIsReconcilable(stored, subPayments);
    }
  });

  it("refunds only the canceled booking's subpayment and marks the cart partially refunded", async () => {
    const cart = await capturedCartWithTwoBookings();
    await service.refundBooking({ tenantId: TENANT, bookingId: "bk-1", actor });

    expect(gateway.refunds).toHaveLength(1);
    expect(gateway.refunds[0]?.request.amount).toBe(3000);

    const subPayments = await store.listSubPayments(TENANT, cart.id);
    const byBooking = new Map(subPayments.map((subPayment) => [subPayment.bookingId, subPayment]));
    expect(byBooking.get("bk-1")?.status).toBe("refunded");
    expect(byBooking.get("bk-2")?.status).toBe("captured");
    expect((await store.findCartById(TENANT, cart.id))?.status).toBe("partially-refunded");

    // Refunding the second booking completes the cart refund.
    await service.refundBooking({ tenantId: TENANT, bookingId: "bk-2", actor });
    expect((await store.findCartById(TENANT, cart.id))?.status).toBe("refunded");

    // A second refund of the same booking is rejected before reaching the gateway.
    await expect(
      service.refundBooking({ tenantId: TENANT, bookingId: "bk-1", actor }),
    ).rejects.toThrow(PaymentInvariantError);
    expect(gateway.refunds).toHaveLength(2);
  });

  it("marks the cart failed when the gateway declines, without touching subpayments", async () => {
    const { cart } = await service.createCart({
      tenantId: TENANT,
      customerId: "cus-1",
      currency: "EUR",
      allocations: [{ bookingId: "bk-3", amount: 5000 }],
      actor,
    });
    gateway.failNextChargeWith = "declined";
    const failed = await service.chargeCart({ tenantId: TENANT, cartId: cart.id, actor });
    expect(failed.status).toBe("failed");
    const subPayments = await store.listSubPayments(TENANT, cart.id);
    expect(subPayments[0]?.status).toBe("pending");
    expect(events.audits.map((audit) => audit.action)).toContain("payment.charge-failed");
  });

  it("processes webhook events at most once per tenant and gateway", async () => {
    const processor = new WebhookProcessor(new InMemoryProcessedWebhookStore(), events);
    let handled = 0;
    const event = { id: "evt_1", type: "charge.succeeded", payload: {} };
    const handler = (): Promise<void> => {
      handled += 1;
      return Promise.resolve();
    };

    expect(await processor.process(TENANT, "fake", event, handler)).toBe("processed");
    expect(await processor.process(TENANT, "fake", event, handler)).toBe("duplicate");
    expect(handled).toBe(1);
    // Same event id from another tenant is independent.
    expect(
      await processor.process("00000000-0000-4000-8000-000000000002", "fake", event, handler),
    ).toBe("processed");
    expect(handled).toBe(2);
  });
});
