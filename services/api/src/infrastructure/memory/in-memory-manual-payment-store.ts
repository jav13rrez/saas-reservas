/**
 * In-memory ManualPaymentRepository (feature 004) for tests and dev. Keyed by
 * `${tenantId}:${bookingId}` to keep tenants isolated and one payment per booking.
 */

import type { ManualPayment } from "@saas-reservas/domain/payments/manual-payment";
import type { ManualPaymentRepository } from "../../application/payments/manual-payment-service.js";

export class InMemoryManualPaymentStore implements ManualPaymentRepository {
  private readonly byBooking = new Map<string, ManualPayment>();

  private key(tenantId: string, bookingId: string): string {
    return `${tenantId}:${bookingId}`;
  }

  findByBooking(tenantId: string, bookingId: string): Promise<ManualPayment | null> {
    return Promise.resolve(this.byBooking.get(this.key(tenantId, bookingId)) ?? null);
  }

  upsert(tenantId: string, payment: ManualPayment): Promise<void> {
    this.byBooking.set(this.key(tenantId, payment.bookingId), { ...payment });
    return Promise.resolve();
  }
}
