/**
 * Cancel/reschedule policy engine (T045).
 *
 * Pure decision function over the booking, the tenant's policies, and the
 * current instant (spec US3 scenario 1: out-of-window attempts are rejected
 * without touching booking, payment, or calendar).
 */

import type { Booking } from "@saas-reservas/domain/bookings/booking";
import type { TenantPolicies } from "@saas-reservas/domain/tenancy/tenant";

export type ChangeAction = "cancel" | "reschedule";

export type ChangeDecision =
  | { allowed: true }
  | { allowed: false; reason: "invalid-status" | "too-late" | "already-started" };

const HOUR_MS = 3_600_000;

export function evaluateChange(input: {
  booking: Booking;
  policies: TenantPolicies;
  action: ChangeAction;
  now: Date;
}): ChangeDecision {
  const { booking, policies, action, now } = input;

  // Only approved bookings can be canceled or rescheduled by their owners;
  // pending/terminal states are handled by the booking state machine itself.
  if (booking.status !== "approved") {
    return { allowed: false, reason: "invalid-status" };
  }

  const startMs = Date.parse(booking.startAt);
  if (now.getTime() >= startMs) {
    return { allowed: false, reason: "already-started" };
  }

  const minNoticeHours =
    action === "cancel" ? policies.cancellationMinNoticeHours : policies.rescheduleMinNoticeHours;
  if (startMs - now.getTime() < minNoticeHours * HOUR_MS) {
    return { allowed: false, reason: "too-late" };
  }
  return { allowed: true };
}
