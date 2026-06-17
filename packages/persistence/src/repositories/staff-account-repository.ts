/**
 * Drizzle adapter for the StaffAccountStore port (ADR-0005 / ADR-0017). Every
 * method runs inside a tenant-scoped transaction; RLS enforces isolation.
 */

import { and, eq } from "drizzle-orm";
import { normalizeStaffEmail, type StaffAccount } from "@saas-reservas/domain/identity/staff";
import type { TenantDb } from "../db.js";
import { staffAccounts } from "../schema.js";

export class DrizzleStaffAccountRepository {
  constructor(private readonly db: TenantDb) {}

  async insert(account: StaffAccount): Promise<void> {
    await this.db.withTenant(account.tenantId, (tx) => tx.insert(staffAccounts).values(account));
  }

  async findByEmail(tenantId: string, email: string): Promise<StaffAccount | null> {
    const normalized = normalizeStaffEmail(email);
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(staffAccounts).where(eq(staffAccounts.email, normalized)).limit(1),
    );
    return rows[0] ?? null;
  }

  async findById(tenantId: string, staffId: string): Promise<StaffAccount | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(staffAccounts)
        .where(and(eq(staffAccounts.id, staffId)))
        .limit(1),
    );
    return rows[0] ?? null;
  }
}
