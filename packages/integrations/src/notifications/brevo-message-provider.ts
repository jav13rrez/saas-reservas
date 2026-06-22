/**
 * Brevo (ex-Sendinblue) transactional email provider (constitution principle IV).
 *
 * Implements the MessageProvider port for the EMAIL channel via Brevo's
 * `POST /v3/smtp/email` endpoint (free tier: 300 emails/day). SMS is intentionally
 * out of scope for this adapter — Brevo SMS is a paid channel — so SMS sends
 * return a clear, non-throwing failure and the caller can fall back or skip.
 *
 * Selected at boot when BREVO_API_KEY is present; the deterministic
 * FakeMessageProvider stays the default so tests and the dev loop are untouched.
 */

import type { BrevoHttpAdapter } from "./brevo-http.js";
import type {
  EmailMessage,
  MessageProvider,
  MessageResult,
  OutboundMessage,
} from "./message-provider.js";

export interface BrevoMessageProviderOptions {
  http: BrevoHttpAdapter;
  apiKey: string;
  /** Default verified sender address; overridable per-message via `message.from`. */
  fromEmail: string;
  /** Optional display name paired with the sender address. */
  fromName?: string | undefined;
}

interface BrevoSendOk {
  messageId?: string;
  messageIds?: string[];
}

interface BrevoError {
  code?: string;
  message?: string;
}

export class BrevoMessageProvider implements MessageProvider {
  readonly name = "brevo";
  private readonly http: BrevoHttpAdapter;
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string | undefined;

  constructor(options: BrevoMessageProviderOptions) {
    this.http = options.http;
    this.apiKey = options.apiKey;
    this.fromEmail = options.fromEmail;
    this.fromName = options.fromName;
  }

  async send(_tenantId: string, message: OutboundMessage): Promise<MessageResult> {
    if (message.channel === "sms") {
      // Email-only adapter: surface a clear, non-throwing failure.
      return { ok: false, error: "sms-not-supported" };
    }
    return this.sendEmail(message);
  }

  private async sendEmail(message: EmailMessage): Promise<MessageResult> {
    const sender = this.resolveSender(message.from);
    if (sender === null) {
      return { ok: false, error: "no-sender-configured" };
    }

    const payload: Record<string, unknown> = {
      sender,
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
    };
    if (message.text !== undefined) {
      payload.textContent = message.text;
    }

    const resp = await this.http.post("/v3/smtp/email", payload, this.apiKey);

    if (resp.status >= 200 && resp.status < 300) {
      const data = resp.data as BrevoSendOk;
      const providerId = data.messageId ?? data.messageIds?.[0];
      return providerId !== undefined ? { ok: true, providerId } : { ok: true };
    }
    return { ok: false, error: brevoError(resp.status, resp.data) };
  }

  /** Per-message `from` wins over the configured default; name only applies to the default. */
  private resolveSender(from: string | undefined): { email: string; name?: string } | null {
    if (from !== undefined && from.length > 0) {
      return { email: from };
    }
    if (this.fromEmail.length === 0) {
      return null;
    }
    return this.fromName !== undefined
      ? { email: this.fromEmail, name: this.fromName }
      : { email: this.fromEmail };
  }
}

function brevoError(status: number, data: unknown): string {
  const err = data as BrevoError;
  const code = err.code ?? `http_${status.toString()}`;
  return err.message !== undefined ? `${code}: ${err.message}` : code;
}
