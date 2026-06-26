/**
 * Manual payment validation (feature 004, T002).
 */

import { describe, expect, it } from "vitest";
import {
  InvalidManualPaymentError,
  validateManualPayment,
  type ManualPayment,
} from "@saas-reservas/domain/payments/manual-payment";

const base = (overrides: Partial<ManualPayment> = {}): ManualPayment => ({
  bookingId: "bk-1",
  method: "cash",
  status: "paid",
  amount: 5000,
  deposit: 0,
  currency: "EUR",
  ...overrides,
});

describe("validateManualPayment", () => {
  it("accepts a well-formed payment", () => {
    expect(() => validateManualPayment(base())).not.toThrow();
    expect(() => validateManualPayment(base({ status: "partial", deposit: 2000 }))).not.toThrow();
  });

  it("rejects unknown method/status", () => {
    expect(() => validateManualPayment(base({ method: "crypto" as never }))).toThrow(
      InvalidManualPaymentError,
    );
    expect(() => validateManualPayment(base({ status: "pending" as never }))).toThrow(
      InvalidManualPaymentError,
    );
  });

  it("rejects negative amount and bad deposit", () => {
    expect(() => validateManualPayment(base({ amount: -1 }))).toThrow(InvalidManualPaymentError);
    expect(() => validateManualPayment(base({ deposit: -1 }))).toThrow(InvalidManualPaymentError);
    expect(() => validateManualPayment(base({ amount: 1000, deposit: 2000 }))).toThrow(
      InvalidManualPaymentError,
    );
  });

  it("carries a stable error code", () => {
    try {
      validateManualPayment(base({ amount: 1000, deposit: 2000 }));
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as InvalidManualPaymentError).code).toBe("invalid-deposit");
    }
  });
});
