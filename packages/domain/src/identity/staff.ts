/**
 * Staff account entity (ADR-0005): tenant-scoped staff with email + password
 * auth, distinct from customer passwordless access. `passwordHash` is an opaque
 * string produced by the application layer (the domain holds no crypto).
 *
 * Roles:
 *  - "admin": may manage the tenant catalog and configuration (/v1/admin/*).
 *  - "staff": operational staff (e.g. providers) with narrower portal access.
 */

export type StaffRole = "admin" | "staff";
export type StaffStatus = "active" | "inactive";

export interface StaffAccount {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: StaffRole;
  status: StaffStatus;
}

export class InvalidStaffAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStaffAccountError";
  }
}

/** Normalizes an email for storage and lookup (trim + lowercase). */
export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateStaffAccount(account: StaffAccount): void {
  if (normalizeStaffEmail(account.email).length === 0) {
    throw new InvalidStaffAccountError("staff email is required");
  }
  if (!account.email.includes("@")) {
    throw new InvalidStaffAccountError("staff email is invalid");
  }
  if (account.passwordHash.length === 0) {
    throw new InvalidStaffAccountError("staff password hash is required");
  }
}
