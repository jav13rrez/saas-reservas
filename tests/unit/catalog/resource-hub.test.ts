/**
 * Resource hub model helpers (ADR-0016): a Resource declares the services it
 * serves, the sites it exists at, and the providers eligible to use it. Empty
 * arrays mean "any" for locations/employees and "none" for services.
 */

import { describe, expect, it } from "vitest";
import {
  hubResourcesForBooking,
  resourceAllowsProvider,
  resourceCompatibleWithLocations,
  resourceServesService,
  type ResourceHub,
} from "@saas-reservas/domain/catalog/resource-hub";

describe("resourceServesService", () => {
  it("matches only declared services", () => {
    const hub = { serviceIds: ["svc-a"], locationIds: [], employeeIds: [] };
    expect(resourceServesService(hub, "svc-a")).toBe(true);
    expect(resourceServesService(hub, "svc-b")).toBe(false);
  });

  it("treats an empty service set as serving none", () => {
    expect(
      resourceServesService({ serviceIds: [], locationIds: [], employeeIds: [] }, "svc-a"),
    ).toBe(false);
  });
});

describe("resourceAllowsProvider", () => {
  it("treats an empty employee set as any provider", () => {
    const hub = { serviceIds: [], locationIds: [], employeeIds: [] };
    expect(resourceAllowsProvider(hub, "anyone")).toBe(true);
  });

  it("restricts to listed providers when set", () => {
    const hub = { serviceIds: [], locationIds: [], employeeIds: ["ana"] };
    expect(resourceAllowsProvider(hub, "ana")).toBe(true);
    expect(resourceAllowsProvider(hub, "luis")).toBe(false);
  });
});

describe("resourceCompatibleWithLocations", () => {
  it("treats an empty resource location set as any location", () => {
    const hub = { serviceIds: [], locationIds: [], employeeIds: [] };
    expect(resourceCompatibleWithLocations(hub, ["loc-1"])).toBe(true);
  });

  it("treats an empty candidate set as location-agnostic", () => {
    const hub = { serviceIds: [], locationIds: ["loc-1"], employeeIds: [] };
    expect(resourceCompatibleWithLocations(hub, [])).toBe(true);
  });

  it("requires intersection when both sides are constrained", () => {
    const hub = { serviceIds: [], locationIds: ["loc-1", "loc-2"], employeeIds: [] };
    expect(resourceCompatibleWithLocations(hub, ["loc-2"])).toBe(true);
    expect(resourceCompatibleWithLocations(hub, ["loc-3"])).toBe(false);
  });
});

describe("hubResourcesForBooking", () => {
  const therapyRoom: ResourceHub = {
    resourceId: "therapy-room",
    serviceIds: ["therapy"],
    locationIds: ["centro"],
    employeeIds: ["ana"],
  };
  const sharedRoom: ResourceHub = {
    resourceId: "shared-room",
    serviceIds: ["therapy", "consulta"],
    locationIds: [], // any location
    employeeIds: [], // any provider
  };

  it("selects resources that serve the service, allow the provider, and fit the location", () => {
    const selected = hubResourcesForBooking([therapyRoom, sharedRoom], {
      serviceId: "therapy",
      providerId: "ana",
      locationIds: ["centro"],
    });
    expect(selected.map((hub) => hub.resourceId).sort()).toEqual(["shared-room", "therapy-room"]);
  });

  it("excludes a resource when the provider is not eligible", () => {
    const selected = hubResourcesForBooking([therapyRoom, sharedRoom], {
      serviceId: "therapy",
      providerId: "luis",
      locationIds: ["centro"],
    });
    expect(selected.map((hub) => hub.resourceId)).toEqual(["shared-room"]);
  });

  it("excludes a resource when the location does not intersect", () => {
    const selected = hubResourcesForBooking([therapyRoom, sharedRoom], {
      serviceId: "therapy",
      providerId: "ana",
      locationIds: ["norte"],
    });
    expect(selected.map((hub) => hub.resourceId)).toEqual(["shared-room"]);
  });

  it("returns nothing when no resource serves the service", () => {
    const selected = hubResourcesForBooking([therapyRoom, sharedRoom], {
      serviceId: "unknown",
      providerId: "ana",
    });
    expect(selected).toEqual([]);
  });
});
