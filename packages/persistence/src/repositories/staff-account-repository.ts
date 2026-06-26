/**
 * Drizzle adapter for the StaffAccountStore port (ADR-0005 / ADR-0017). Every
 * method runs inside a tenant-scoped transaction; RLS enforces isolation.
 */

import { and, eq } from "drizzle-orm";
import { normalizeStaffEmail, StaffLinkError, type StaffAccount } from "@saas-reservas/domain/identity/staff";
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

  async findByProviderId(tenantId: string, providerId: string): Promise<StaffAccount | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(staffAccounts)
        .where(eq(staffAccounts.providerId, providerId))
        .limit(1),
    );
    return rows[0] ?? null;
  }

  async setProviderLink(tenantId: string, staffId: string, providerId: string): Promise<StaffAccount> {
    try {
      const rows = await this.db.withTenant(tenantId, (tx) =>
        tx
          .update(staffAccounts)
          .set({ providerId })
          .where(eq(staffAccounts.id, staffId))
          .returning(),
      );
      if (rows.length === 0) throw new StaffLinkError("staff-not-found");
      return rows[0]!;
    } catch (err) {
      // Postgres unique constraint violation: 23505
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code: string }).code === "23505"
      ) {
        throw new StaffLinkError("provider-conflict");
      }
      throw err;
    }
  }

  async clearProviderLink(tenantId: string, staffId: string): Promise<StaffAccount> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .update(staffAccounts)
        .set({ providerId: null })
        .where(eq(staffAccounts.id, staffId))
        .returning(),
    );
    if (rows.length === 0) throw new StaffLinkError("staff-not-found");
    return rows[0]!;
  }

  async list(tenantId: string): Promise<StaffAccount[]> {
    return this.db.withTenant(tenantId, (tx) => tx.select().from(staffAccounts));
  }
}
