/**
 * Hub read model drives canonical availability (ADR-0016 cutover).
 *
 * The resources that serve a service form an interchangeable pool: a slot stays
 * available while at least one eligible resource has a free unit, and disappears
 * once the pool is exhausted. A provider eligible for none of the serving
 * resources gets zero availability even though the service has resources.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import type { Service } from "@saas-reservas/domain/catalog/service";
import type { Provider, ProviderScheduleEntry } from "@saas-reservas/domain/providers/provider";
import type { Interval } from "@saas-reservas/domain/scheduling/time";

const TENANT = "00000000-0000-4000-8000-000000000001";
const SERVICE = "svc-1";
const ANA = "prov-ana";
const LUIS = "prov-luis";
const DATE = "2026-06-15"; // Monday
const SLOT_10 = "2026-06-15T10:00:00.000Z";
const SLOT_11 = "2026-06-15T11:00:00.000Z";
const TZ = "UTC";

const service: Service = {
  id: SERVICE,
  tenantId: TENANT,
  categoryId: "cat-1",
  name: "Therapy",
  durationMinutes: 60,
  priceAmount: 5000,
  currency: "EUR",
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  minCapacity: 1,
  maxCapacity: 1,
  status: "active",
};

const schedule: ProviderScheduleEntry[] = [
  { kind: "weekly", weekday: 1, startTime: "10:00", endTime: "12:00", breaks: [] },
];

function provider(id: string): Provider {
  return {
    id,
    tenantId: TENANT,
    email: `${id}@test`,
    displayName: id,
    status: "active",
    timezone: TZ,
    permissions: [],
  };
}

function occupied(startIso: string): Interval {
  const start = Date.parse(startIso);
  return { start, end: start + 60 * 60_000 };
}

describe("hub-driven availability", () => {
  let store: InMemoryStore;
  let availability: AvailabilityService;

  async function startTimes(providerId = ANA): Promise<string[]> {
    const result = await availability.availability({
      tenantId: TENANT,
      serviceId: SERVICE,
      date: DATE,
      providerId,
      tenantTimezone: TZ,
    });
    if (!result.ok) {
      throw new Error(`availability failed: ${result.reason}`);
    }
    return result.slots.map((slot) => slot.startAt);
  }

  beforeEach(async () => {
    store = new InMemoryStore();
    availability = new AvailabilityService(store, store);
    await store.insertService(service);
    await store.insertProvider(provider(ANA));
    await store.assignProvider({
      tenantId: TENANT,
      serviceId: SERVICE,
      providerId: ANA,
      status: "active",
    });
    await store.setProviderSchedule(TENANT, ANA, schedule);
  });

  it("treats a service with no hub resources as unconstrained", async () => {
    expect(await startTimes()).toEqual([SLOT_10, SLOT_11]);
  });

  it("keeps a slot while any pool resource has a free unit and drops it when exhausted", async () => {
    // Two interchangeable rooms, one unit each, both serving the service.
    await store.insertResource({
      id: "room-1",
      tenantId: TENANT,
      name: "Room 1",
      quantity: 1,
      status: "active",
    });
    await store.insertResource({
      id: "room-2",
      tenantId: TENANT,
      name: "Room 2",
      quantity: 1,
      status: "active",
    });
    await store.setResourceServices(TENANT, "room-1", [SERVICE]);
    await store.setResourceServices(TENANT, "room-2", [SERVICE]);

    expect(await startTimes()).toEqual([SLOT_10, SLOT_11]);

    // Other providers consume the rooms (shared capacity, not Ana's calendar).
    // One room taken at 10:00 — the other still covers the slot for Ana.
    store.recordBookingOccupancy(
      TENANT,
      "prov-x",
      occupied(SLOT_10),
      [{ resourceId: "room-1", units: 1 }],
      "b1",
    );
    expect(await startTimes()).toEqual([SLOT_10, SLOT_11]);

    // Both rooms taken at 10:00 — the pool is exhausted, 10:00 disappears.
    store.recordBookingOccupancy(
      TENANT,
      "prov-y",
      occupied(SLOT_10),
      [{ resourceId: "room-2", units: 1 }],
      "b2",
    );
    expect(await startTimes()).toEqual([SLOT_11]);
  });

  it("respects provider/resource location compatibility", async () => {
    await store.insertResource({
      id: "room-centro",
      tenantId: TENANT,
      name: "Room Centro",
      quantity: 1,
      status: "active",
    });
    await store.setResourceServices(TENANT, "room-centro", [SERVICE]);
    await store.setResourceLocations(TENANT, "room-centro", ["centro"]);

    // Ana works only at Norte: the only serving room is at Centro -> no slots.
    await store.setProviderLocations(TENANT, ANA, ["norte"]);
    expect(await startTimes(ANA)).toEqual([]);

    // Move Ana to Centro: the room is now compatible -> slots return.
    await store.setProviderLocations(TENANT, ANA, ["centro"]);
    expect(await startTimes(ANA)).toEqual([SLOT_10, SLOT_11]);
  });

  it("offers zero availability when the provider is eligible for no serving resource", async () => {
    await store.insertResource({
      id: "room-1",
      tenantId: TENANT,
      name: "Room 1",
      quantity: 1,
      status: "active",
    });
    await store.setResourceServices(TENANT, "room-1", [SERVICE]);
    // Only Luis may use the only room serving the service; Ana is not eligible.
    await store.setResourceEmployees(TENANT, "room-1", [LUIS]);

    expect(await startTimes(ANA)).toEqual([]);
  });
});
