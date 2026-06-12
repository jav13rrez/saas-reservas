/**
 * T016: service rules — total duration (service + extras + buffers),
 * customer-facing appointment duration, capacity constraints, and validation.
 */

import { describe, expect, it } from "vitest";
import {
  appointmentDurationMinutes,
  assertAttendeesWithinCapacity,
  InvalidCatalogEntityError,
  totalDurationMinutes,
  validateResource,
  validateService,
  type Extra,
  type Service,
} from "@saas-reservas/domain/catalog/service";

const TENANT = "00000000-0000-4000-8000-000000000001";

const service: Service = {
  id: "svc-1",
  tenantId: TENANT,
  categoryId: "cat-1",
  name: "Massage",
  durationMinutes: 60,
  priceAmount: 50,
  currency: "EUR",
  bufferBeforeMinutes: 10,
  bufferAfterMinutes: 15,
  minCapacity: 1,
  maxCapacity: 4,
  status: "active",
};

const extra = (minutes: number): Extra => ({
  id: `extra-${String(minutes)}`,
  tenantId: TENANT,
  serviceId: service.id,
  name: "Add-on",
  durationMinutes: minutes,
  priceAmount: 10,
  multiplyByPeople: true,
  status: "active",
});

describe("duration rules", () => {
  it("computes total = buffer_before + service + extras + buffer_after", () => {
    expect(totalDurationMinutes(service, [])).toBe(10 + 60 + 15);
    expect(totalDurationMinutes(service, [extra(20), extra(5)])).toBe(10 + 60 + 25 + 15);
  });

  it("excludes buffers from the customer-facing appointment duration", () => {
    expect(appointmentDurationMinutes(service, [extra(20)])).toBe(80);
  });

  it("never multiplies extra duration by attendees (only price multiplies)", () => {
    // multiplyByPeople affects pricing, not occupancy: duration is added once.
    const withPeopleMultiplier = extra(30);
    expect(withPeopleMultiplier.multiplyByPeople).toBe(true);
    expect(totalDurationMinutes(service, [withPeopleMultiplier])).toBe(10 + 60 + 30 + 15);
  });
});

describe("capacity constraints", () => {
  it("accepts attendee counts within min/max capacity", () => {
    expect(() => {
      assertAttendeesWithinCapacity(service, 1);
    }).not.toThrow();
    expect(() => {
      assertAttendeesWithinCapacity(service, 4);
    }).not.toThrow();
  });

  it("rejects attendee counts outside capacity", () => {
    expect(() => {
      assertAttendeesWithinCapacity(service, 0);
    }).toThrow(InvalidCatalogEntityError);
    expect(() => {
      assertAttendeesWithinCapacity(service, 5);
    }).toThrow(InvalidCatalogEntityError);
    expect(() => {
      assertAttendeesWithinCapacity(service, 2.5);
    }).toThrow(InvalidCatalogEntityError);
  });
});

describe("entity validation", () => {
  it("rejects non-positive durations, negative buffers, and max < min capacity", () => {
    expect(() => {
      validateService({ ...service, durationMinutes: 0 });
    }).toThrow(InvalidCatalogEntityError);
    expect(() => {
      validateService({ ...service, bufferBeforeMinutes: -5 });
    }).toThrow(InvalidCatalogEntityError);
    expect(() => {
      validateService({ ...service, maxCapacity: 0 });
    }).toThrow(InvalidCatalogEntityError);
    expect(() => {
      validateService(service);
    }).not.toThrow();
  });

  it("rejects resources without positive integer quantity", () => {
    const resource = {
      id: "res-1",
      tenantId: TENANT,
      name: "Room",
      quantity: 1,
      status: "active" as const,
    };
    expect(() => {
      validateResource(resource);
    }).not.toThrow();
    expect(() => {
      validateResource({ ...resource, quantity: 0 });
    }).toThrow(InvalidCatalogEntityError);
    expect(() => {
      validateResource({ ...resource, quantity: 1.5 });
    }).toThrow(InvalidCatalogEntityError);
  });
});
