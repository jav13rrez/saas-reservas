/**
 * In-memory StaffAccountStore for tests and local dev. Lookups filter by
 * tenantId explicitly, mirroring the tenant-scoped SQL the Drizzle adapter runs.
 */

import { normalizeStaffEmail, type StaffAccount } from "@saas-reservas/domain/identity/staff";
import type { StaffAccountStore } from "../../application/identity/staff-auth-service.js";

export class InMemoryStaffAccountStore implements StaffAccountStore {
  private readonly accounts: StaffAccount[] = [];

  insert(account: StaffAccount): Promise<void> {
    this.accounts.push(account);
    return Promise.resolve();
  }

  findByEmail(tenantId: string, email: string): Promise<StaffAccount | null> {
    const normalized = normalizeStaffEmail(email);
    return Promise.resolve(
      this.accounts.find(
        (account) => account.tenantId === tenantId && account.email === normalized,
      ) ?? null,
    );
  }

  findById(tenantId: string, staffId: string): Promise<StaffAccount | null> {
    return Promise.resolve(
      this.accounts.find((account) => account.tenantId === tenantId && account.id === staffId) ??
        null,
    );
  }
}
