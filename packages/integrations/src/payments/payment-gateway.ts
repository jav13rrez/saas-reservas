/**
 * Payment gateway adapter boundary (T037, constitution principle IV).
 *
 * Stripe/PayPal adapters implement this interface with tenant-owned encrypted
 * credentials; application services never see gateway SDKs. The fake gateway
 * gives tests deterministic charges, refunds, and failure injection.
 *
 * All amounts are integer minor units.
 */

export interface ChargeRequest {
  tenantId: string;
  amount: number;
  currency: string;
  /** Stable per checkout attempt; gateways deduplicate on it. */
  idempotencyKey: string;
  description?: string;
  /**
   * Tokenized funding source to charge (e.g. a Stripe PaymentMethod id). When
   * provided, real gateways confirm the charge synchronously; when omitted they
   * may create an unconfirmed intent to be completed client-side. The fake
   * gateway ignores it.
   */
  paymentMethod?: string;
}

export type ChargeResult =
  | { ok: true; chargeId: string }
  | { ok: false; reason: "declined" | "gateway-error" };

export interface RefundRequest {
  tenantId: string;
  chargeId: string;
  amount: number;
}

export type RefundResult =
  | { ok: true; refundId: string }
  | { ok: false; reason: "charge-not-found" | "exceeds-charge" | "gateway-error" };

export interface PaymentGateway {
  readonly name: string;
  createCharge(request: ChargeRequest): Promise<ChargeResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
}

interface FakeCharge {
  request: ChargeRequest;
  chargeId: string;
  refundedAmount: number;
}

/** Deterministic in-memory gateway for tests and local development. */
export class FakePaymentGateway implements PaymentGateway {
  readonly name = "fake";
  readonly charges: FakeCharge[] = [];
  readonly refunds: { request: RefundRequest; refundId: string }[] = [];
  /** When set, the next createCharge fails with this reason once. */
  failNextChargeWith: "declined" | "gateway-error" | null = null;

  private sequence = 0;

  createCharge(request: ChargeRequest): Promise<ChargeResult> {
    if (this.failNextChargeWith !== null) {
      const reason = this.failNextChargeWith;
      this.failNextChargeWith = null;
      return Promise.resolve({ ok: false, reason });
    }
    const existing = this.charges.find(
      (charge) => charge.request.idempotencyKey === request.idempotencyKey,
    );
    if (existing !== undefined) {
      return Promise.resolve({ ok: true, chargeId: existing.chargeId });
    }
    this.sequence += 1;
    const chargeId = `ch_${String(this.sequence)}`;
    this.charges.push({ request, chargeId, refundedAmount: 0 });
    return Promise.resolve({ ok: true, chargeId });
  }

  refund(request: RefundRequest): Promise<RefundResult> {
    const charge = this.charges.find((candidate) => candidate.chargeId === request.chargeId);
    if (charge?.request.tenantId !== request.tenantId) {
      return Promise.resolve({ ok: false, reason: "charge-not-found" });
    }
    if (charge.refundedAmount + request.amount > charge.request.amount) {
      return Promise.resolve({ ok: false, reason: "exceeds-charge" });
    }
    charge.refundedAmount += request.amount;
    this.sequence += 1;
    const refundId = `re_${String(this.sequence)}`;
    this.refunds.push({ request, refundId });
    return Promise.resolve({ ok: true, refundId });
  }
}
