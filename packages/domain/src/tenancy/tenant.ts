/**
 * Tenant aggregate: identity, domains, branding, locale/timezone, and booking
 * policies (T019). The tenant is the root of every other aggregate.
 */

export type TenantStatus = "active" | "suspended" | "archived";

export interface TenantBranding {
  primaryColor: string;
  logoUrl?: string;
}

export interface TenantPolicies {
  /** Minimum notice a customer needs to cancel, in hours. */
  cancellationMinNoticeHours: number;
  /** Minimum notice a customer needs to reschedule, in hours. */
  rescheduleMinNoticeHours: number;
  /** How far ahead the public widget offers slots, in days. */
  bookingHorizonDays: number;
  /** Whether new bookings need staff approval before confirmation. */
  requiresApproval: boolean;
}

export interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  status: TenantStatus;
  defaultTimezone: string;
  defaultLocale: string;
  branding: TenantBranding;
  policies: TenantPolicies;
}

export type TenantDomainKind = "subdomain" | "custom";

export interface TenantDomain {
  id: string;
  tenantId: string;
  hostname: string;
  kind: TenantDomainKind;
  verificationStatus: "pending" | "verified";
}

export const DEFAULT_POLICIES: TenantPolicies = {
  cancellationMinNoticeHours: 24,
  rescheduleMinNoticeHours: 24,
  bookingHorizonDays: 60,
  requiresApproval: false,
};

export const DEFAULT_BRANDING: TenantBranding = {
  primaryColor: "#1f6feb",
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export class InvalidTenantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTenantError";
  }
}

export function validateTenant(tenant: Tenant): void {
  if (!SLUG_PATTERN.test(tenant.slug)) {
    throw new InvalidTenantError(
      `tenant slug ${JSON.stringify(tenant.slug)} must be 3-63 chars of [a-z0-9-], not starting/ending with "-"`,
    );
  }
  if (tenant.displayName.trim().length === 0) {
    throw new InvalidTenantError("tenant display name is required");
  }
  assertValidTimezone(tenant.defaultTimezone);
  const { policies } = tenant;
  if (
    policies.cancellationMinNoticeHours < 0 ||
    policies.rescheduleMinNoticeHours < 0 ||
    policies.bookingHorizonDays < 1
  ) {
    throw new InvalidTenantError("tenant policies out of range");
  }
}

export function assertValidTimezone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new InvalidTenantError(`invalid IANA time zone: ${JSON.stringify(timeZone)}`);
  }
}
