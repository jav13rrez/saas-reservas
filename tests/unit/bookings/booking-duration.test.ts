/**
 * T027: total duration formula with extras and buffers
 * (spec US2 scenario 1: total = servicio + extras + buffer_before + buffer_after),
 * and the customer-facing booking window derived from it.
 */

import { describe, expect, it } from "vitest";
import {
  appointmentDurationMinutes,
  totalDurationMinutes,
  type Extra,
  type Service,
} from "@saas-reservas/domain/catalog/service";
import { MINUTE_MS } from "@saas-reservas/domain/scheduling/time";

const TENANT = "00000000-0000-4000-8000-000000000001";

const service: Service = {
  id: "svc-1",
  tenantId: TENANT,
  categoryId: "cat-1",
  name: "Session",
  durationMinutes: 45,
  priceAmount: 5000,
  currency: "EUR",
  bufferBeforeMinutes: 5,
  bufferAfterMinutes: 10,
  minCapacity: 1,
  maxCapacity: 6,
  status: "active",
};

const extraOf = (minutes: number, multiplyByPeople = false): Extra => ({
  id: `extra-${String(minutes)}`,
  tenantId: TENANT,
  serviceId: service.id,
  name: "Add-on",
  durationMinutes: minutes,
  priceAmount: 1000,
  multiplyByPeople,
  status: "active",
});

describe("booking duration formula", () => {
  it("applies total = service + extras + buffer_before + buffer_after", () => {
    expect(totalDurationMinutes(service, [])).toBe(5 + 45 + 10);
    expect(totalDurationMinutes(service, [extraOf(15), extraOf(20)])).toBe(5 + 45 + 35 + 10);
  });

  it("adds extra duration once regardless of attendee multiplication", () => {
    // multiplyByPeople only affects price; occupancy grows by the extra once.
    expect(totalDurationMinutes(service, [extraOf(30, true)])).toBe(5 + 45 + 30 + 10);
  });

  it("derives the customer-facing booking window without buffers", () => {
    const extras = [extraOf(15)];
    const startAt = Date.parse("2026-06-15T09:00:00Z");
    const endAt = startAt + appointmentDurationMinutes(service, extras) * MINUTE_MS;
    expect(new Date(endAt).toISOString()).toBe("2026-06-15T10:00:00.000Z"); // 45 + 15 min
    // Occupancy seen by the availability engine still includes both buffers.
    expect(totalDurationMinutes(service, extras)).toBe(75);
  });
});
