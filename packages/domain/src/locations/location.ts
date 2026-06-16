/**
 * Location entity (multi-site / multi-sede).
 *
 * A Location is a physical site that owns resources and where providers may
 * work. Resources belong to exactly one location; providers may be assigned to
 * one or more locations. Availability for a (service, provider) is computed
 * against the resources of the relevant location(s).
 *
 * Aligns the implementation with the spec (US1: "ubicaciones") and the
 * data-model fields `Resource.location_id` / `Resource.scope`.
 */

import { assertValidTimezone } from "../tenancy/tenant.js";

export type LocationStatus = "active" | "inactive";

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  /**
   * Optional IANA time zone for this site; when unset, scheduling falls back to
   * the provider's zone and then the tenant default.
   */
  timezone?: string;
  /** Optional free-form address shown in admin/portal surfaces. */
  address?: string;
  status: LocationStatus;
}

export class InvalidLocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLocationError";
  }
}

export function validateLocation(location: Location): void {
  if (location.name.trim().length === 0) {
    throw new InvalidLocationError("location name is required");
  }
  if (location.timezone !== undefined) {
    // Reuse tenant timezone validation; rethrow as a location error for clarity.
    try {
      assertValidTimezone(location.timezone);
    } catch {
      throw new InvalidLocationError(
        `invalid IANA time zone: ${JSON.stringify(location.timezone)}`,
      );
    }
  }
}
