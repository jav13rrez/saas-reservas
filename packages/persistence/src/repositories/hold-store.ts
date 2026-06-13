/**
 * Drizzle adapter for the checkout HoldStore port: holds survive process
 * restarts, so a payment webhook arriving after a deploy still settles the
 * pending booking. SlotRef dates are serialized as ISO strings in jsonb.
 */

import { eq } from "drizzle-orm";
import type { Interval } from "@saas-reservas/domain/scheduling/time";
import type { TenantDb } from "../db.js";
import { checkoutHolds } from "../schema.js";

interface SlotRef {
  tenantId: string;
  providerId: string;
  resourceId: string;
  startAt: Date;
}

interface CheckoutHold {
  tenantId: string;
  bookingId: string;
  providerId: string;
  occupied: Interval;
  resources: { resourceId: string; units: number }[];
  slots: { slot: SlotRef; token: string }[];
}

export class DrizzleHoldStore {
  constructor(private readonly db: TenantDb) {}

  async save(cartId: string, hold: CheckoutHold): Promise<void> {
    await this.db.withTenant(hold.tenantId, (tx) =>
      tx.insert(checkoutHolds).values({
        cartId,
        tenantId: hold.tenantId,
        bookingId: hold.bookingId,
        providerId: hold.providerId,
        occupied: hold.occupied,
        resources: hold.resources,
        slots: hold.slots.map(({ slot, token }) => ({
          slot: { ...slot, startAt: slot.startAt.toISOString() },
          token,
        })),
      }),
    );
  }

  async find(tenantId: string, cartId: string): Promise<CheckoutHold | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(checkoutHolds).where(eq(checkoutHolds.cartId, cartId)).limit(1),
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      tenantId: row.tenantId,
      bookingId: row.bookingId,
      providerId: row.providerId,
      occupied: row.occupied,
      resources: row.resources,
      slots: row.slots.map(({ slot, token }) => ({
        slot: { ...slot, startAt: new Date(slot.startAt) },
        token,
      })),
    };
  }

  async remove(tenantId: string, cartId: string): Promise<void> {
    await this.db.withTenant(tenantId, (tx) =>
      tx.delete(checkoutHolds).where(eq(checkoutHolds.cartId, cartId)),
    );
  }
}
