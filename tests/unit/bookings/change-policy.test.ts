/**
 * T041: minimum cancel/reschedule notice windows — attempts inside the window,
 * after start, or on non-approved bookings are rejected.
 */

import { describe, expect, it } from "vitest";
import type { Booking, BookingStatus } from "@saas-reservas/domain/bookings/booking";
import { DEFAULT_POLICIES, type TenantPolicies } from "@saas-reservas/domain/tenancy/tenant";
import { evaluateChange } from "@saas-reservas/api/application/bookings/change-policy-engine";

const START = "2026-06-15T10:00:00.000Z";

const booking = (status: BookingStatus = "approved"): Booking => ({
  id: "bk-1",
  tenantId: "00000000-0000-4000-8000-000000000001",
  customerId: "cus-1",
  serviceId: "svc-1",
  providerId: "prov-1",
  status,
  startAt: START,
  endAt: "2026-06-15T11:00:00.000Z",
  durationMinutes: 60,
  attendees: 1,
  extras: [],
  totalAmount: 5000,
  currency: "EUR",
  source: "widget",
});

const policies: TenantPolicies = {
  ...DEFAULT_POLICIES,
  cancellationMinNoticeHours: 24,
  rescheduleMinNoticeHours: 12,
};

const hoursBefore = (hours: number): Date => new Date(Date.parse(START) - hours * 3_600_000);

describe("change policy engine", () => {
  it("allows cancel and reschedule with enough notice", () => {
    expect(
      evaluateChange({ booking: booking(), policies, action: "cancel", now: hoursBefore(25) }),
    ).toEqual({ allowed: true });
    expect(
      evaluateChange({ booking: booking(), policies, action: "reschedule", now: hoursBefore(13) }),
    ).toEqual({ allowed: true });
  });

  it("rejects attempts inside the minimum notice window per action", () => {
    expect(
      evaluateChange({ booking: booking(), policies, action: "cancel", now: hoursBefore(23) }),
    ).toEqual({ allowed: false, reason: "too-late" });
    // 13 hours out: cancel (24h) is too late, reschedule (12h) still allowed.
    expect(
      evaluateChange({ booking: booking(), policies, action: "cancel", now: hoursBefore(13) }),
    ).toEqual({ allowed: false, reason: "too-late" });
    expect(
      evaluateChange({ booking: booking(), policies, action: "reschedule", now: hoursBefore(11) }),
    ).toEqual({ allowed: false, reason: "too-late" });
  });

  it("treats the window boundary as allowed (exactly N hours before)", () => {
    expect(
      evaluateChange({ booking: booking(), policies, action: "cancel", now: hoursBefore(24) }),
    ).toEqual({ allowed: true });
  });

  it("rejects changes once the appointment has started", () => {
    expect(
      evaluateChange({
        booking: booking(),
        policies,
        action: "cancel",
        now: new Date(START),
      }),
    ).toEqual({ allowed: false, reason: "already-started" });
  });

  it("rejects changes on non-approved bookings", () => {
    for (const status of ["pending", "rejected", "expired", "canceled", "rescheduled"] as const) {
      expect(
        evaluateChange({
          booking: booking(status),
          policies,
          action: "cancel",
          now: hoursBefore(48),
        }),
      ).toEqual({ allowed: false, reason: "invalid-status" });
    }
  });
});
