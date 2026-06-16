/**
 * Payment reconciliation worker (T082).
 *
 * Compares internal booking payment records against Stripe Connect charges
 * and flags discrepancies (amount mismatch, missing capture, duplicate).
 * Returns a reconciliation summary per tenant run.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface BookingPaymentRecord {
  bookingId: string;
  stripePaymentIntentId: string;
  /** Amount in minor units (e.g. cents) */
  expectedAmount: number;
  currency: string;
  status: "pending" | "captured" | "refunded" | "failed";
}

export interface StripeChargeRecord {
  paymentIntentId: string;
  /** Actual captured amount in minor units */
  capturedAmount: number;
  currency: string;
  status: "succeeded" | "failed" | "refunded" | "pending";
}

export type ReconciliationStatus =
  | "ok"
  | "amount_mismatch"
  | "missing_in_stripe"
  | "duplicate_capture"
  | "status_mismatch";

export interface ReconciliationLineItem {
  bookingId: string;
  paymentIntentId: string;
  status: ReconciliationStatus;
  note?: string | undefined;
}

export interface ReconciliationSummary {
  tenantId: string;
  ranAt: string;
  totalChecked: number;
  discrepancies: ReconciliationLineItem[];
}

// ---------------------------------------------------------------------------
// Reconciliation port
// ---------------------------------------------------------------------------

export interface StripeChargeRepository {
  fetchByPaymentIntentIds(
    tenantId: string,
    intentIds: string[],
  ): Promise<Map<string, StripeChargeRecord>>;
}

// ---------------------------------------------------------------------------
// Core reconciliation logic
// ---------------------------------------------------------------------------

export async function reconcilePayments(
  tenantId: string,
  records: BookingPaymentRecord[],
  stripeRepo: StripeChargeRepository,
): Promise<ReconciliationSummary> {
  const intentIds = records.map((r) => r.stripePaymentIntentId);
  const charges = await stripeRepo.fetchByPaymentIntentIds(tenantId, intentIds);

  const seenIntentIds = new Set<string>();
  const discrepancies: ReconciliationLineItem[] = [];

  for (const record of records) {
    const { bookingId, stripePaymentIntentId, expectedAmount, status } = record;

    if (seenIntentIds.has(stripePaymentIntentId)) {
      discrepancies.push({
        bookingId,
        paymentIntentId: stripePaymentIntentId,
        status: "duplicate_capture",
        note: "Same paymentIntentId referenced by multiple booking records",
      });
      continue;
    }
    seenIntentIds.add(stripePaymentIntentId);

    const charge = charges.get(stripePaymentIntentId);

    if (charge === undefined) {
      discrepancies.push({
        bookingId,
        paymentIntentId: stripePaymentIntentId,
        status: "missing_in_stripe",
        note: "No charge found in Stripe for this payment intent",
      });
      continue;
    }

    if (charge.capturedAmount !== expectedAmount) {
      discrepancies.push({
        bookingId,
        paymentIntentId: stripePaymentIntentId,
        status: "amount_mismatch",
        note: `Expected ${expectedAmount.toString()} ${record.currency}, got ${charge.capturedAmount.toString()} ${charge.currency}`,
      });
      continue;
    }

    const expectedStripeStatus = status === "captured" ? "succeeded" : status;
    if (charge.status !== expectedStripeStatus) {
      discrepancies.push({
        bookingId,
        paymentIntentId: stripePaymentIntentId,
        status: "status_mismatch",
        note: `Internal: ${status}, Stripe: ${charge.status}`,
      });
      continue;
    }
  }

  return {
    tenantId,
    ranAt: new Date().toISOString(),
    totalChecked: records.length,
    discrepancies,
  };
}

// ---------------------------------------------------------------------------
// Fake for tests
// ---------------------------------------------------------------------------

export class FakeStripeChargeRepository implements StripeChargeRepository {
  private readonly charges = new Map<string, StripeChargeRecord>();

  seed(intentId: string, charge: StripeChargeRecord): void {
    this.charges.set(intentId, charge);
  }

  fetchByPaymentIntentIds(
    _tenantId: string,
    intentIds: string[],
  ): Promise<Map<string, StripeChargeRecord>> {
    const result = new Map<string, StripeChargeRecord>();
    for (const id of intentIds) {
      const c = this.charges.get(id);
      if (c !== undefined) result.set(id, c);
    }
    return Promise.resolve(result);
  }
}
