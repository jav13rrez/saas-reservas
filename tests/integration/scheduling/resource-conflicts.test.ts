/**
 * T017: shared resource blocking across competing services (spec US1 scenario 3).
 *
 * Two services share a resource with quantity 1. When one service holds the
 * resource (booking or provisional checkout hold), the other service cannot
 * offer overlapping slots for the resource's full occupied duration, buffers
 * included — even with a different provider.
 */

import { describe, expect, it } from "vitest";
import {
  computeAvailableSlots,
  type AvailabilityInput,
  type ResourceAllocation,
} from "@saas-reservas/api/application/scheduling/availability-engine";
import { totalDurationMinutes, type Service } from "@saas-reservas/domain/catalog/service";
import { MINUTE_MS } from "@saas-reservas/domain/scheduling/time";
import type { ProviderScheduleEntry } from "@saas-reservas/domain/providers/provider";

const TENANT = "00000000-0000-4000-8000-000000000001";
const DATE = "2026-06-15"; // Monday
const TZ = "UTC";

const schedule: ProviderScheduleEntry[] = [
  { kind: "weekly", weekday: 1, startTime: "09:00", endTime: "12:00", breaks: [] },
];

function makeService(id: string, durationMinutes: number, bufferAfterMinutes = 0): Service {
  return {
    id,
    tenantId: TENANT,
    categoryId: "cat-1",
    name: id,
    durationMinutes,
    priceAmount: 50,
    currency: "EUR",
    bufferBeforeMinutes: 0,
    bufferAfterMinutes,
    minCapacity: 1,
    maxCapacity: 1,
    status: "active",
  };
}

const serviceA = makeService("service-a", 60, 30); // occupies 90 minutes
const serviceB = makeService("service-b", 60);

function queryFor(service: Service, allocations: ResourceAllocation[]): AvailabilityInput {
  return {
    date: DATE,
    timezone: TZ,
    service,
    selectedExtras: [],
    scheduleEntries: schedule,
    providerBusy: [],
    resources: [
      {
        resourceId: "room-1",
        resourceQuantity: 1,
        unitsRequired: 1,
        existingAllocations: allocations,
      },
    ],
  };
}

/** Resource hold for a service-A booking starting 09:00 UTC: 90 minutes occupied. */
function serviceAHoldAt(startIso: string): ResourceAllocation {
  const start = Date.parse(startIso);
  return { start, end: start + totalDurationMinutes(serviceA, []) * MINUTE_MS, units: 1 };
}

describe("shared resource conflicts", () => {
  it("offers both services every slot when the resource is free", () => {
    const slotsB = computeAvailableSlots(queryFor(serviceB, []));
    expect(slotsB.map((slot) => slot.startAt)).toEqual([
      "2026-06-15T09:00:00.000Z",
      "2026-06-15T10:00:00.000Z",
      "2026-06-15T11:00:00.000Z",
    ]);
  });

  it("blocks service B for service A's full occupied duration, buffers included", () => {
    // Service A booked 09:00-10:00 plus 30 min buffer -> resource busy until 10:30.
    const slotsB = computeAvailableSlots(
      queryFor(serviceB, [serviceAHoldAt("2026-06-15T09:00:00Z")]),
    );
    // 09:00 and 10:00 overlap the hold; 11:00 is the only slot left.
    expect(slotsB.map((slot) => slot.startAt)).toEqual(["2026-06-15T11:00:00.000Z"]);
  });

  it("keeps slots available when the resource has spare units", () => {
    const input = queryFor(serviceB, [serviceAHoldAt("2026-06-15T09:00:00Z")]);
    const resource = input.resources[0];
    if (resource === undefined) {
      throw new Error("missing resource demand");
    }
    resource.resourceQuantity = 2;
    const slotsB = computeAvailableSlots(input);
    expect(slotsB).toHaveLength(3);
  });

  it("blocks competing slots even when providers differ (resource is the bottleneck)", () => {
    // providerBusy is empty for service B's provider; only the shared resource blocks.
    const slotsB = computeAvailableSlots(
      queryFor(serviceB, [serviceAHoldAt("2026-06-15T10:00:00Z")]),
    );
    expect(slotsB.map((slot) => slot.startAt)).toEqual(["2026-06-15T09:00:00.000Z"]);
  });
});

describe("provider-resource eligibility (model B)", () => {
  it("offers all slots when the provider is eligible for the demanded resource", () => {
    const input = { ...queryFor(serviceB, []), providerEligibleResourceIds: ["room-1"] };
    expect(computeAvailableSlots(input)).toHaveLength(3);
  });

  it("offers no slots when the provider is not eligible for a demanded resource", () => {
    const input = { ...queryFor(serviceB, []), providerEligibleResourceIds: ["room-2"] };
    expect(computeAvailableSlots(input)).toEqual([]);
  });

  it("treats an empty eligibility list as unconstrained", () => {
    const input = { ...queryFor(serviceB, []), providerEligibleResourceIds: [] };
    expect(computeAvailableSlots(input)).toHaveLength(3);
  });
});
