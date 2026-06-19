/**
 * Drizzle adapter for the LocationRepository port. Every method runs inside a
 * tenant-scoped transaction; RLS enforces isolation. Mirrors the `locations`
 * table from infra/postgres/003-locations-eligibility.sql.
 */

import { eq } from "drizzle-orm";
import type { Location } from "@saas-reservas/domain/locations/location";
import type { TenantDb } from "../db.js";
import { locations } from "../schema.js";

export class DrizzleLocationRepository {
  constructor(private readonly db: TenantDb) {}

  async insertLocation(location: Location): Promise<void> {
    await this.db.withTenant(location.tenantId, (tx) => tx.insert(locations).values(location));
  }

  async updateLocation(location: Location): Promise<void> {
    await this.db.withTenant(location.tenantId, (tx) =>
      tx
        .update(locations)
        .set({
          name: location.name,
          timezone: location.timezone ?? null,
          address: location.address ?? null,
          status: location.status,
        })
        .where(eq(locations.id, location.id)),
    );
  }

  async listLocations(tenantId: string): Promise<Location[]> {
    const rows = await this.db.withTenant(tenantId, (tx) => tx.select().from(locations));
    return rows.map(toLocation);
  }

  async findLocationById(tenantId: string, locationId: string): Promise<Location | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(locations).where(eq(locations.id, locationId)).limit(1),
    );
    const row = rows[0];
    return row === undefined ? null : toLocation(row);
  }
}

/** Map a DB row (nullable timezone/address) to the domain Location (optional fields). */
function toLocation(row: typeof locations.$inferSelect): Location {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    status: row.status,
    ...(row.timezone !== null ? { timezone: row.timezone } : {}),
    ...(row.address !== null ? { address: row.address } : {}),
  };
}
