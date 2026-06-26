/**
 * Manual payment (feature 004): a staff-entered payment record for money taken
 * outside the online gateway (cash, card terminal, bank transfer). One record per
 * booking. Distinct from the gateway cart/subpayment model so reconciliation is
 * never polluted. Money is integer minor units.
 */

export type ManualPaymentMethod = "cash" | "card" | "bank_transfer" | "other";
export type ManualPaymentStatus = "paid" | "partial" | "not_paid";

export const MANUAL_PAYMENT_METHODS: readonly ManualPaymentMethod[] = [
  "cash",
  "card",
  "bank_transfer",
  "other",
];
export const MANUAL_PAYMENT_STATUSES: readonly ManualPaymentStatus[] = [
  "paid",
  "partial",
  "not_paid",
];

export interface ManualPayment {
  bookingId: string;
  method: ManualPaymentMethod;
  status: ManualPaymentStatus;
  /** Total recorded amount, minor units. */
  amount: number;
  /** Optional deposit already taken, minor units (0..amount). */
  deposit: number;
  currency: string;
  transactionRef?: string;
  notes?: string;
}

export type ManualPaymentValidationCode =
  | "invalid-method"
  | "invalid-status"
  | "invalid-amount"
  | "invalid-deposit";

export class InvalidManualPaymentError extends Error {
  readonly code: ManualPaymentValidationCode;
  constructor(code: ManualPaymentValidationCode, message: string) {
    super(message);
    this.name = "InvalidManualPaymentError";
    this.code = code;
  }
}

export function validateManualPayment(payment: ManualPayment): void {
  if (!MANUAL_PAYMENT_METHODS.includes(payment.method)) {
    throw new InvalidManualPaymentError("invalid-method", `unknown method: ${payment.method}`);
  }
  if (!MANUAL_PAYMENT_STATUSES.includes(payment.status)) {
    throw new InvalidManualPaymentError("invalid-status", `unknown status: ${payment.status}`);
  }
  if (!Number.isInteger(payment.amount) || payment.amount < 0) {
    throw new InvalidManualPaymentError("invalid-amount", "amount must be a non-negative integer");
  }
  if (
    !Number.isInteger(payment.deposit) ||
    payment.deposit < 0 ||
    payment.deposit > payment.amount
  ) {
    throw new InvalidManualPaymentError(
      "invalid-deposit",
      "deposit must be a non-negative integer not exceeding amount",
    );
  }
}
