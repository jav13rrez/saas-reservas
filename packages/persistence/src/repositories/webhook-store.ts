/**
 * Drizzle adapter for the ProcessedWebhookStore port. The composite primary
 * key makes recordIfNew atomic: ON CONFLICT DO NOTHING inserts exactly once.
 */

import type { TenantDb } from "../db.js";
import { processedWebhooks } from "../schema.js";

export class DrizzleProcessedWebhookStore {
  constructor(private readonly db: TenantDb) {}

  async recordIfNew(tenantId: string, gateway: string, eventId: string): Promise<boolean> {
    const inserted = await this.db.withTenant(tenantId, (tx) =>
      tx
        .insert(processedWebhooks)
        .values({ tenantId, gateway, eventId })
        .onConflictDoNothing()
        .returning({ eventId: processedWebhooks.eventId }),
    );
    return inserted.length === 1;
  }
}
