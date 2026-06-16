/**
 * T081 – Booking notification dispatcher tests.
 */

import { describe, it, expect } from "vitest";
import {
  dispatchBookingNotification,
  type BookingNotificationPayload,
} from "@saas-reservas/worker/jobs/booking-notification-dispatcher";
import { FakeMessageProvider } from "@saas-reservas/integrations/notifications/message-provider";

function makePayload(
  overrides: Partial<BookingNotificationPayload> = {},
): BookingNotificationPayload {
  return {
    tenantId: "t1",
    bookingId: "bk-1",
    event: "confirmed",
    customerEmail: "customer@example.com",
    customerName: "Test User",
    serviceName: "Haircut",
    providerName: "Ana",
    startAt: "2026-06-20T10:00:00Z",
    durationMinutes: 45,
    ...overrides,
  };
}

describe("dispatchBookingNotification", () => {
  it("sends an email when no phone is present", async () => {
    const provider = new FakeMessageProvider();
    const result = await dispatchBookingNotification(provider, makePayload());
    expect(result.channel).toBe("email");
    expect(provider.sentTo("customer@example.com")).toHaveLength(1);
  });

  it("sends an SMS when customer has a phone number", async () => {
    const provider = new FakeMessageProvider();
    const result = await dispatchBookingNotification(
      provider,
      makePayload({ customerPhone: "+34600000001" }),
    );
    expect(result.channel).toBe("sms");
    expect(provider.sentTo("+34600000001")).toHaveLength(1);
  });

  it("includes meeting join URL in message body", async () => {
    const provider = new FakeMessageProvider();
    await dispatchBookingNotification(
      provider,
      makePayload({ meetingJoinUrl: "https://meet.google.com/abc-def" }),
    );
    const sent = provider.sentTo("customer@example.com");
    expect(sent).toHaveLength(1);
    const msg = sent[0];
    if (msg === undefined) return;
    if (msg.channel === "email") {
      expect(msg.text).toContain("https://meet.google.com/abc-def");
    }
  });

  it("returns error when provider fails", async () => {
    const provider = new FakeMessageProvider();
    provider.failNextWith = "provider unavailable";
    const result = await dispatchBookingNotification(provider, makePayload());
    expect(result.error).toBe("provider unavailable");
  });

  describe("event types", () => {
    const events = ["confirmed", "cancelled", "rescheduled", "reminder", "rejected"] as const;
    for (const event of events) {
      it(`dispatches notification for ${event} event`, async () => {
        const provider = new FakeMessageProvider();
        const result = await dispatchBookingNotification(provider, makePayload({ event }));
        expect(result.channel).toBe("email");
        expect(provider.sentTo("customer@example.com")).toHaveLength(1);
      });
    }
  });
});
