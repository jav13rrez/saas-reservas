/**
 * Email/SMS notification adapter boundaries (T073, constitution principle IV).
 *
 * MessageProvider is the adapter interface. Application services call it
 * without knowing the concrete provider (SendGrid, Twilio, etc.).
 * FakeMessageProvider captures sends for test assertions.
 */

export type MessageChannel = "email" | "sms";

export interface EmailMessage {
  channel: "email";
  to: string;
  subject: string;
  html: string;
  text?: string | undefined;
  from?: string | undefined;
}

export interface SmsMessage {
  channel: "sms";
  to: string;
  body: string;
  from?: string | undefined;
}

export type OutboundMessage = EmailMessage | SmsMessage;

export interface MessageResult {
  ok: boolean;
  providerId?: string | undefined;
  error?: string | undefined;
}

export interface MessageProvider {
  readonly name: string;
  send(tenantId: string, message: OutboundMessage): Promise<MessageResult>;
}

// ---------------------------------------------------------------------------
// Fake provider for tests
// ---------------------------------------------------------------------------

export interface CapturedSend {
  tenantId: string;
  message: OutboundMessage;
  result: MessageResult;
}

export class FakeMessageProvider implements MessageProvider {
  readonly name = "fake";
  readonly sent: CapturedSend[] = [];
  private sequence = 0;

  /** When set, the next send returns this error once. */
  failNextWith: string | null = null;

  send(tenantId: string, message: OutboundMessage): Promise<MessageResult> {
    if (this.failNextWith !== null) {
      const error = this.failNextWith;
      this.failNextWith = null;
      const result: MessageResult = { ok: false, error };
      this.sent.push({ tenantId, message, result });
      return Promise.resolve(result);
    }
    this.sequence += 1;
    const result: MessageResult = { ok: true, providerId: `msg_${this.sequence.toString()}` };
    this.sent.push({ tenantId, message, result });
    return Promise.resolve(result);
  }

  sentTo(to: string): CapturedSend[] {
    return this.sent.filter((s) => s.message.to === to);
  }

  clear(): void {
    this.sent.length = 0;
    this.sequence = 0;
  }
}
