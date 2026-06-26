/**
 * Drizzle adapter for the ManualPaymentRepository port (feature 004). Every
 * method runs inside a tenant-scoped transaction; RLS enforces isolation. One
 * row per (tenant, booking) — upsert on that unique key.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { ManualPayment } from "@saas-reservas/domain/payments/manual-payment";
import type { TenantDb } from "../db.js";
import { manualPayments } from "../schema.js";

// Structurally implements the application's ManualPaymentRepository port (the
// port type lives in services/api; persistence must not depend on api).
export class DrizzleManualPaymentRepository {
  constructor(private readonly db: TenantDb) {}

  async findByBooking(tenantId: string, bookingId: string): Promise<ManualPayment | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(manualPayments)
        .where(and(eq(manualPayments.bookingId, bookingId)))
        .limit(1),
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      bookingId: row.bookingId,
      method: row.method,
      status: row.status,
      amount: row.amount,
      deposit: row.deposit,
      currency: row.currency,
      ...(row.transactionRef !== null ? { transactionRef: row.transactionRef } : {}),
      ...(row.notes !== null ? { notes: row.notes } : {}),
    };
  }

  async upsert(tenantId: string, payment: ManualPayment): Promise<void> {
    const now = new Date();
    await this.db.withTenant(tenantId, (tx) =>
      tx
        .insert(manualPayments)
        .values({
          id: randomUUID(),
          tenantId,
          bookingId: payment.bookingId,
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          deposit: payment.deposit,
          currency: payment.currency,
          transactionRef: payment.transactionRef ?? null,
          notes: payment.notes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [manualPayments.tenantId, manualPayments.bookingId],
          set: {
            method: payment.method,
            status: payment.status,
            amount: payment.amount,
            deposit: payment.deposit,
            currency: payment.currency,
            transactionRef: payment.transactionRef ?? null,
            notes: payment.notes ?? null,
            updatedAt: now,
          },
        }),
    );
  }
}
