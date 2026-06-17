/**
 * Multi-site location validation.
 */

import { describe, expect, it } from "vitest";
import {
  InvalidLocationError,
  validateLocation,
  type Location,
} from "@saas-reservas/domain/locations/location";

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
