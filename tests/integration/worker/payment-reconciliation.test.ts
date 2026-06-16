/**
 * T082 – Payment reconciliation worker tests.
 */

import { describe, it, expect } from "vitest";
import {
  reconcilePayments,
  FakeStripeChargeRepository,
  type BookingPaymentRecord,
} from "@saas-reservas/worker/jobs/payment-reconciliation";

function makeRecord(overrides: Partial<BookingPaymentRecord> = {}): BookingPaymentRecord {
  return {
    bookingId: "bk-1",
    stripePaymentIntentId: "pi_test_001",
    expectedAmount: 5000,
    currency: "EUR",
    status: "captured",
    ...overrides,
  };
}

describe("reconcilePayments", () => {
  it("returns no discrepancies for matched records", async () => {
    const repo = new FakeStripeChargeRepository();
    repo.seed("pi_test_001", {
      paymentIntentId: "pi_test_001",
      capturedAmount: 5000,
      currency: "EUR",
      status: "succeeded",
    });
    const result = await reconcilePayments("t1", [makeRecord()], repo);
    expect(result.discrepancies).toHaveLength(0);
    expect(result.totalChecked).toBe(1);
  });

  it("flags missing payment intent in Stripe", async () => {
    const repo = new FakeStripeChargeRepository();
    const result = await reconcilePayments("t1", [makeRecord()], repo);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0]?.status).toBe("missing_in_stripe");
  });

  it("flags amount mismatch", async () => {
    const repo = new FakeStripeChargeRepository();
    repo.seed("pi_test_001", {
      paymentIntentId: "pi_test_001",
      capturedAmount: 4999, // wrong
      currency: "EUR",
      status: "succeeded",
    });
    const result = await reconcilePayments("t1", [makeRecord()], repo);
    expect(result.discrepancies[0]?.status).toBe("amount_mismatch");
  });

  it("flags status mismatch", async () => {
    const repo = new FakeStripeChargeRepository();
    repo.seed("pi_test_001", {
      paymentIntentId: "pi_test_001",
      capturedAmount: 5000,
      currency: "EUR",
      status: "failed", // internal says captured
    });
    const result = await reconcilePayments("t1", [makeRecord()], repo);
    expect(result.discrepancies[0]?.status).toBe("status_mismatch");
  });

  it("flags duplicate payment intent across booking records", async () => {
    const repo = new FakeStripeChargeRepository();
    repo.seed("pi_test_001", {
      paymentIntentId: "pi_test_001",
      capturedAmount: 5000,
      currency: "EUR",
      status: "succeeded",
    });
    const records = [
      makeRecord({ bookingId: "bk-1" }),
      makeRecord({ bookingId: "bk-2" }), // same intent id
    ];
    const result = await reconcilePayments("t1", records, repo);
    expect(result.discrepancies.some((d) => d.status === "duplicate_capture")).toBe(true);
  });

  it("handles multiple records with mixed results", async () => {
    const repo = new FakeStripeChargeRepository();
    repo.seed("pi_ok", {
      paymentIntentId: "pi_ok",
      capturedAmount: 3000,
      currency: "EUR",
      status: "succeeded",
    });
    const records = [
      makeRecord({
        bookingId: "bk-1",
        stripePaymentIntentId: "pi_ok",
        expectedAmount: 3000,
        status: "captured",
      }),
      makeRecord({ bookingId: "bk-2", stripePaymentIntentId: "pi_missing" }),
    ];
    const result = await reconcilePayments("t1", records, repo);
    expect(result.totalChecked).toBe(2);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0]?.status).toBe("missing_in_stripe");
  });
});
