/**
 * ManualPaymentService over the in-memory adapter (feature 004): upsert + read,
 * audit emission, validation rejection, and cross-tenant isolation (SC-005).
 */

import { describe, expect, it } from "vitest";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { ManualPaymentService } from "@saas-reservas/api/application/payments/manual-payment-service";
import { InMemoryManualPaymentStore } from "@saas-reservas/api/infrastructure/memory/in-memory-manual-payment-store";
import { InvalidManualPaymentError } from "@saas-reservas/domain/payments/manual-payment";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";

const TENANT_A = "00000000-0000-4000-8000-00000000000a";
const TENANT_B = "00000000-0000-4000-8000-00000000000b";

function makeService(): { service: ManualPaymentService; events: InMemoryEventSink } {
  const events = new InMemoryEventSink();
  return { service: new ManualPaymentService(new InMemoryManualPaymentStore(), events), events };
}

describe("ManualPaymentService", () => {
  it("upserts, reads back, and audits", async () => {
    const { service, events } = makeService();
    await service.upsertForBooking({
      tenantId: TENANT_A,
      actor: SYSTEM_ACTOR,
      payment: {
        bookingId: "bk-1",
        method: "card",
        status: "paid",
        amount: 5000,
        deposit: 0,
        currency: "EUR",
      },
    });
    const read = await service.getForBooking(TENANT_A, "bk-1");
    expect(read?.method).toBe("card");
    expect(read?.status).toBe("paid");
    expect(events.audits.some((a) => a.action === "booking.manual-payment-recorded")).toBe(true);

    // Update (one record per booking).
    await service.upsertForBooking({
      tenantId: TENANT_A,
      actor: SYSTEM_ACTOR,
      payment: {
        bookingId: "bk-1",
        method: "cash",
        status: "partial",
        amount: 5000,
        deposit: 2000,
        currency: "EUR",
      },
    });
    const updated = await service.getForBooking(TENANT_A, "bk-1");
    expect(updated?.method).toBe("cash");
    expect(updated?.deposit).toBe(2000);
  });

  it("rejects an invalid payment with no write", async () => {
    const { service } = makeService();
    await expect(
      service.upsertForBooking({
        tenantId: TENANT_A,
        actor: SYSTEM_ACTOR,
        payment: {
          bookingId: "bk-2",
          method: "cash",
          status: "paid",
          amount: -1,
          deposit: 0,
          currency: "EUR",
        },
      }),
    ).rejects.toBeInstanceOf(InvalidManualPaymentError);
    expect(await service.getForBooking(TENANT_A, "bk-2")).toBeNull();
  });

  it("keeps tenants isolated", async () => {
    const { service } = makeService();
    await service.upsertForBooking({
      tenantId: TENANT_A,
      actor: SYSTEM_ACTOR,
      payment: {
        bookingId: "shared-id",
        method: "card",
        status: "paid",
        amount: 3000,
        deposit: 0,
        currency: "EUR",
      },
    });
    // Same bookingId under tenant B must not see tenant A's payment.
    expect(await service.getForBooking(TENANT_B, "shared-id")).toBeNull();
  });
});
