/**
 * Location application service (multi-site / "ubicaciones").
 *
 * A Location is a physical site that owns resources and where providers work.
 * The admin console manages locations as the root of the assignment chain
 * (Ubicación -> Recurso -> Proveedor -> Servicio). This service is the canonical
 * CRUD over the `locations` table (RLS-scoped), mirroring CatalogService's
 * audited-write style. Reads return every location regardless of status so the
 * admin can render and toggle inactive sites.
 */

import { randomUUID } from "node:crypto";
import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import { validateLocation, type Location } from "@saas-reservas/domain/locations/location";
import type { EventSink } from "../events.js";

export interface LocationRepository {
  insertLocation(location: Location): Promise<void>;
  updateLocation(location: Location): Promise<void>;
  listLocations(tenantId: string): Promise<Location[]>;
  findLocationById(tenantId: string, locationId: string): Promise<Location | null>;
}

export class LocationService {
  constructor(
    private readonly locations: LocationRepository,
    private readonly events: EventSink,
  ) {}

  listLocations(tenantId: string): Promise<Location[]> {
    return this.locations.listLocations(tenantId);
  }

  async createLocation(input: {
    tenantId: string;
    name: string;
    timezone?: string;
    address?: string;
    actor: Actor;
  }): Promise<Location> {
    const location: Location = {
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      status: "active",
      ...(input.timezone !== undefined && input.timezone !== ""
        ? { timezone: input.timezone }
        : {}),
      ...(input.address !== undefined && input.address !== "" ? { address: input.address } : {}),
    };
    validateLocation(location);
    await this.locations.insertLocation(location);
    await this.audit(input.tenantId, input.actor, "catalog.location-created", location.id);
    return location;
  }

  /** Toggle a location active/inactive. Returns null when it does not exist. */
  async setLocationActive(input: {
    tenantId: string;
    locationId: string;
    active: boolean;
    actor: Actor;
  }): Promise<Location | null> {
    const existing = await this.locations.findLocationById(input.tenantId, input.locationId);
    if (existing === null) {
      return null;
    }
    const updated: Location = { ...existing, status: input.active ? "active" : "inactive" };
    await this.locations.updateLocation(updated);
    await this.audit(input.tenantId, input.actor, "catalog.location-updated", updated.id, {
      active: input.active,
    });
    return updated;
  }

  private async audit(
    tenantId: string,
    actor: Actor,
    action: string,
    entityId: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const event = createDomainEvent({ tenantId, type: action, actor, payload: { entityId } });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action,
        entityType: "location",
        entityId,
        ...(metadata ? { metadata } : {}),
      }),
    );
  }
}
