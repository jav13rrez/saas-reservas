/**
 * In-memory StaffAccountStore for tests and local dev. Lookups filter by
 * tenantId explicitly, mirroring the tenant-scoped SQL the Drizzle adapter runs.
 */

import { normalizeStaffEmail, StaffLinkError, type StaffAccount } from "@saas-reservas/domain/identity/staff";
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

  findByProviderId(tenantId: string, providerId: string): Promise<StaffAccount | null> {
    return Promise.resolve(
      this.accounts.find(
        (account) => account.tenantId === tenantId && account.providerId === providerId,
      ) ?? null,
    );
  }

  setProviderLink(tenantId: string, staffId: string, providerId: string): Promise<StaffAccount> {
    const idx = this.accounts.findIndex(
      (account) => account.tenantId === tenantId && account.id === staffId,
    );
    if (idx === -1) throw new StaffLinkError("staff-not-found");

    const conflict = this.accounts.find(
      (account) =>
        account.tenantId === tenantId &&
        account.providerId === providerId &&
        account.id !== staffId,
    );
    if (conflict !== undefined) throw new StaffLinkError("provider-conflict");

    const updated = { ...this.accounts[idx]!, providerId };
    this.accounts[idx] = updated;
    return Promise.resolve(updated);
  }

  clearProviderLink(tenantId: string, staffId: string): Promise<StaffAccount> {
    const idx = this.accounts.findIndex(
      (account) => account.tenantId === tenantId && account.id === staffId,
    );
    if (idx === -1) throw new StaffLinkError("staff-not-found");
    const updated = { ...this.accounts[idx]!, providerId: null };
    this.accounts[idx] = updated;
    return Promise.resolve(updated);
  }

  list(tenantId: string): Promise<StaffAccount[]> {
    return Promise.resolve(this.accounts.filter((account) => account.tenantId === tenantId));
  }
}
