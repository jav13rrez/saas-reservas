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
  /** ISO-4217 currency code (e.g. "EUR"); the tenant default for new money records. */
  currency: string;
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

export const DEFAULT_CURRENCY = "EUR";

/**
 * ISO-4217 currencies the product supports. A plain 3-letter regex would accept
 * nonsense like "ZZZ"; an allowlist keeps validation honest without pulling in a
 * full currency library. Extend as new markets are onboarded.
 */
export const SUPPORTED_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CAD",
  "AUD",
  "MXN",
  "BRL",
  "JPY",
] as const;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Stable validation codes; map 1:1 to the admin-settings API error codes so the
 * delivery layer never has to match on free-text messages.
 */
export type TenantValidationCode =
  | "invalid-slug"
  | "invalid-display-name"
  | "invalid-locale"
  | "invalid-timezone"
  | "invalid-currency"
  | "invalid-color"
  | "policy-out-of-range";

export class InvalidTenantError extends Error {
  readonly code: TenantValidationCode;
  constructor(message: string, code: TenantValidationCode = "invalid-slug") {
    super(message);
    this.name = "InvalidTenantError";
    this.code = code;
  }
}

export function validateTenant(tenant: Tenant): void {
  if (!SLUG_PATTERN.test(tenant.slug)) {
    throw new InvalidTenantError(
      `tenant slug ${JSON.stringify(tenant.slug)} must be 3-63 chars of [a-z0-9-], not starting/ending with "-"`,
      "invalid-slug",
    );
  }
  if (tenant.displayName.trim().length === 0) {
    throw new InvalidTenantError("tenant display name is required", "invalid-display-name");
  }
  if (tenant.defaultLocale.trim().length === 0) {
    throw new InvalidTenantError("tenant locale is required", "invalid-locale");
  }
  assertValidTimezone(tenant.defaultTimezone);
  assertValidCurrency(tenant.currency);
  assertValidHexColor(tenant.branding.primaryColor);
  const { policies } = tenant;
  if (
    policies.cancellationMinNoticeHours < 0 ||
    policies.rescheduleMinNoticeHours < 0 ||
    policies.bookingHorizonDays < 1
  ) {
    throw new InvalidTenantError("tenant policies out of range", "policy-out-of-range");
  }
}

export function assertValidTimezone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new InvalidTenantError(
      `invalid IANA time zone: ${JSON.stringify(timeZone)}`,
      "invalid-timezone",
    );
  }
}

export function assertValidCurrency(code: string): void {
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(code)) {
    throw new InvalidTenantError(
      `unsupported currency code: ${JSON.stringify(code)}`,
      "invalid-currency",
    );
  }
}

export function assertValidHexColor(color: string): void {
  if (!HEX_COLOR_PATTERN.test(color)) {
    throw new InvalidTenantError(`invalid hex color: ${JSON.stringify(color)}`, "invalid-color");
  }
}
