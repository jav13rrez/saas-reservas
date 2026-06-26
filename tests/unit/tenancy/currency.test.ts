/**
 * Tenant currency + branding-color validation (feature 003, T003).
 * Domain-level rules behind the tenant settings surface.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_CURRENCY,
  assertValidCurrency,
  assertValidHexColor,
  validateTenant,
  type Tenant,
  InvalidTenantError,
} from "@saas-reservas/domain/tenancy/tenant";

const baseTenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: "t1",
  slug: "acme-co",
  displayName: "Acme Co",
  status: "active",
  defaultTimezone: "Europe/Madrid",
  defaultLocale: "es-ES",
  currency: DEFAULT_CURRENCY,
  branding: { primaryColor: "#1f6feb" },
  policies: {
    cancellationMinNoticeHours: 24,
    rescheduleMinNoticeHours: 24,
    bookingHorizonDays: 60,
    requiresApproval: false,
  },
  ...overrides,
});

describe("assertValidCurrency", () => {
  it("accepts ISO-4217 allowlisted codes", () => {
    for (const code of ["EUR", "USD", "GBP"]) {
      expect(() => assertValidCurrency(code)).not.toThrow();
    }
  });

  it("rejects lowercase, wrong-length, and unknown codes", () => {
    for (const bad of ["eur", "EU", "EURO", "ZZZ", ""]) {
      expect(() => assertValidCurrency(bad)).toThrow(InvalidTenantError);
    }
  });
});

describe("assertValidHexColor", () => {
  it("accepts #rgb and #rrggbb", () => {
    for (const c of ["#fff", "#1f6feb", "#0B7D6B"]) {
      expect(() => assertValidHexColor(c)).not.toThrow();
    }
  });

  it("rejects names and malformed hex", () => {
    for (const bad of ["blue", "1f6feb", "#12", "#xyzxyz", ""]) {
      expect(() => assertValidHexColor(bad)).toThrow(InvalidTenantError);
    }
  });
});

describe("validateTenant with currency + color", () => {
  it("passes a well-formed tenant", () => {
    expect(() => validateTenant(baseTenant())).not.toThrow();
  });

  it("rejects an invalid currency", () => {
    expect(() => validateTenant(baseTenant({ currency: "eur" }))).toThrow(InvalidTenantError);
  });

  it("rejects an invalid branding color", () => {
    expect(() => validateTenant(baseTenant({ branding: { primaryColor: "blue" } }))).toThrow(
      InvalidTenantError,
    );
  });

  it("rejects an empty locale", () => {
    expect(() => validateTenant(baseTenant({ defaultLocale: "  " }))).toThrow(InvalidTenantError);
  });
});
