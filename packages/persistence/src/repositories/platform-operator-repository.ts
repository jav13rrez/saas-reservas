/**
 * Drizzle adapter for the PlatformOperatorStore port (ADR-0022). Platform
 * operators are a PLATFORM-GLOBAL table (like tenants/tenant_domains), so every
 * method runs through `db.global` with NO tenant context — there is no tenant_id
 * to bind and no RLS on this table.
 */

import { count, eq } from "drizzle-orm";
import {
  normalizePlatformEmail,
  type PlatformOperator,
} from "@saas-reservas/domain/identity/platform";
import type { TenantDb } from "../db.js";
import { platformOperators } from "../schema.js";

export class DrizzlePlatformOperatorRepository {
  constructor(private readonly db: TenantDb) {}

  async insert(operator: PlatformOperator): Promise<void> {
    const now = new Date();
    await this.db.global((db) =>
      db.insert(platformOperators).values({ ...operator, createdAt: now, updatedAt: now }),
    );
  }

  async findByEmail(email: string): Promise<PlatformOperator | null> {
    const normalized = normalizePlatformEmail(email);
    const rows = await this.db.global((db) =>
      db.select().from(platformOperators).where(eq(platformOperators.email, normalized)).limit(1),
    );
    return rows[0] !== undefined ? toOperator(rows[0]) : null;
  }

  async count(): Promise<number> {
    const rows = await this.db.global((db) =>
      db.select({ value: count() }).from(platformOperators),
    );
    return rows[0]?.value ?? 0;
  }

  async list(): Promise<PlatformOperator[]> {
    const rows = await this.db.global((db) => db.select().from(platformOperators));
    return rows.map(toOperator);
  }
}

function toOperator(row: typeof platformOperators.$inferSelect): PlatformOperator {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    status: row.status,
  };
}
