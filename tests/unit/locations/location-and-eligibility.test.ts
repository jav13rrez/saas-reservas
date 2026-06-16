/**
 * Multi-site locations (model C) and provider-resource eligibility (model B).
 */

import { describe, expect, it } from "vitest";
import {
  InvalidLocationError,
  validateLocation,
  type Location,
} from "@saas-reservas/domain/locations/location";
import { providerEligibleForResources } from "@saas-reservas/domain/catalog/service";

const TENANT = "00000000-0000-4000-8000-000000000001";

const location: Location = {
  id: "loc-1",
  tenantId: TENANT,
  name: "Sede Centro",
  timezone: "Europe/Madrid",
  status: "active",
};

describe("location validation", () => {
  it("accepts a well-formed location", () => {
    expect(() => {
      validateLocation(location);
    }).not.toThrow();
  });

  it("accepts a location without an explicit time zone", () => {
    const { timezone: _omit, ...rest } = location;
    expect(() => {
      validateLocation(rest);
    }).not.toThrow();
  });

  it("rejects a blank name", () => {
    expect(() => {
      validateLocation({ ...location, name: "  " });
    }).toThrow(InvalidLocationError);
  });

  it("rejects an invalid IANA time zone", () => {
    expect(() => {
      validateLocation({ ...location, timezone: "Mars/Phobos" });
    }).toThrow(InvalidLocationError);
  });
});

describe("provider-resource eligibility (model B)", () => {
  it("treats a provider with no eligibility entries as unconstrained", () => {
    expect(providerEligibleForResources(undefined, ["room-a"])).toBe(true);
    expect(providerEligibleForResources([], ["room-a", "room-b"])).toBe(true);
  });

  it("allows a provider only for the resources they are eligible for", () => {
    expect(providerEligibleForResources(["room-a"], ["room-a"])).toBe(true);
    expect(providerEligibleForResources(["room-a", "room-b"], ["room-b"])).toBe(true);
  });

  it("blocks a provider when the service demands a resource they cannot use", () => {
    expect(providerEligibleForResources(["room-a"], ["room-b"])).toBe(false);
    expect(providerEligibleForResources(["room-a"], ["room-a", "room-b"])).toBe(false);
  });

  it("requires eligibility for every demanded resource", () => {
    expect(providerEligibleForResources(["room-a", "scanner"], ["room-a", "scanner"])).toBe(true);
    expect(providerEligibleForResources(["room-a", "scanner"], ["room-a", "mri"])).toBe(false);
  });
});
