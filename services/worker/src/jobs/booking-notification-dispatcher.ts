/**
 * Booking notification orchestrator (T081).
 *
 * Dispatches email/SMS confirmations for booking lifecycle events.
 * Runs inside runJob for idempotency and retry. Chooses the channel
 * (email or sms) based on available customer contact info, falling back
 * from SMS to email when a phone number is absent.
 */

import type {
  MessageProvider,
  OutboundMessage,
} from "@saas-reservas/integrations/notifications/message-provider";

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export type BookingNotificationEvent =
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "reminder"
  | "rejected";

export interface BookingNotificationPayload {
  tenantId: string;
  bookingId: string;
  event: BookingNotificationEvent;
  customerEmail: string;
  customerPhone?: string | undefined;
  customerName: string;
  serviceName: string;
  providerName: string;
  /** ISO datetime string */
  startAt: string;
  /** Duration in minutes */
  durationMinutes: number;
  /** Optional join URL for video meetings */
  meetingJoinUrl?: string | undefined;
}

// ---------------------------------------------------------------------------
// Notification builder
// ---------------------------------------------------------------------------

function subjectFor(event: BookingNotificationEvent, serviceName: string): string {
  const map: Record<BookingNotificationEvent, string> = {
    confirmed: `Booking confirmed: ${serviceName}`,
    cancelled: `Booking cancelled: ${serviceName}`,
    rescheduled: `Booking rescheduled: ${serviceName}`,
    reminder: `Reminder: ${serviceName}`,
    rejected: `Booking rejected: ${serviceName}`,
  };
  return map[event];
}

function bodyFor(payload: BookingNotificationPayload): string {
  const date = new Date(payload.startAt).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const lines = [
    `Hi ${payload.customerName},`,
    ``,
    `Your booking for ${payload.serviceName} with ${payload.providerName} on ${date} (${payload.durationMinutes.toString()} min) has been ${payload.event}.`,
  ];
  if (payload.meetingJoinUrl !== undefined) {
    lines.push(``, `Join link: ${payload.meetingJoinUrl}`);
  }
  return lines.join("\n");
}

function buildMessage(payload: BookingNotificationPayload): OutboundMessage {
  const body = bodyFor(payload);
  if (payload.customerPhone !== undefined) {
    return {
      channel: "sms",
      to: payload.customerPhone,
      body,
    };
  }
  return {
    channel: "email",
    to: payload.customerEmail,
    subject: subjectFor(payload.event, payload.serviceName),
    html: body.replace(/\n/g, "<br>"),
    text: body,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export interface NotificationResult {
  channel: "email" | "sms";
  providerId?: string | undefined;
  error?: string | undefined;
}

export async function dispatchBookingNotification(
  provider: MessageProvider,
  payload: BookingNotificationPayload,
): Promise<NotificationResult> {
  const message = buildMessage(payload);
  const result = await provider.send(payload.tenantId, message);
  return {
    channel: message.channel,
    providerId: result.providerId,
    error: result.ok ? undefined : (result.error ?? "unknown error"),
  };
}
