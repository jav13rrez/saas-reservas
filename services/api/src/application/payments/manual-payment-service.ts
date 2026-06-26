/**
 * Manual payment application service (feature 004, US3): record/update a single
 * staff-entered payment per booking (money taken outside the gateway). Domain
 * validation lives in `validateManualPayment`; persistence and audit are ports.
 */

import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import {
  validateManualPayment,
  type ManualPayment,
} from "@saas-reservas/domain/payments/manual-payment";
import type { EventSink } from "../events.js";

export interface ManualPaymentRepository {
  findByBooking(tenantId: string, bookingId: string): Promise<ManualPayment | null>;
  /** Create or replace the manual payment for a booking (one per booking). */
  upsert(tenantId: string, payment: ManualPayment): Promise<void>;
}

export class ManualPaymentService {
  constructor(
    private readonly repo: ManualPaymentRepository,
    private readonly events: EventSink,
  ) {}

  getForBooking(tenantId: string, bookingId: string): Promise<ManualPayment | null> {
    return this.repo.findByBooking(tenantId, bookingId);
  }

  async upsertForBooking(input: {
    tenantId: string;
    payment: ManualPayment;
    actor: Actor;
  }): Promise<ManualPayment> {
    validateManualPayment(input.payment);
    await this.repo.upsert(input.tenantId, input.payment);
    const event = createDomainEvent({
      tenantId: input.tenantId,
      type: "booking.manual-payment-recorded",
      actor: input.actor,
      payload: { entityId: input.payment.bookingId },
    });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action: "booking.manual-payment-recorded",
        entityType: "manual-payment",
        entityId: input.payment.bookingId,
        metadata: {
          method: input.payment.method,
          status: input.payment.status,
          amount: input.payment.amount,
        },
      }),
    );
    return input.payment;
  }
}
