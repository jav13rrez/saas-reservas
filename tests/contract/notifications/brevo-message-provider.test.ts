/**
 * BrevoMessageProvider + resolveMessageProvider contract tests.
 *
 * Verifies the real email adapter behind the MessageProvider port: the Brevo
 * `POST /v3/smtp/email` wire shape, sender resolution (per-message override vs.
 * configured default), success/error mapping, the SMS-not-supported guard, and
 * the factory's selection (Brevo when keyed, fake otherwise) with fail-fast on a
 * missing sender. A recording fake HTTP stands in for Brevo.
 */

import { describe, it, expect } from "vitest";
import { BrevoMessageProvider } from "@saas-reservas/integrations/notifications/brevo-message-provider";
import type {
  BrevoHttpAdapter,
  BrevoHttpResponse,
} from "@saas-reservas/integrations/notifications/brevo-http";
import { resolveMessageProvider } from "@saas-reservas/integrations/notifications/message-provider-factory";
import type {
  EmailMessage,
  SmsMessage,
} from "@saas-reservas/integrations/notifications/message-provider";

interface RecordedCall {
  path: string;
  body: unknown;
  apiKey: string;
}

class RecordingBrevoHttp implements BrevoHttpAdapter {
  readonly calls: RecordedCall[] = [];
  response: BrevoHttpResponse = { status: 201, data: { messageId: "msg_default" } };

  post(path: string, body: unknown, apiKey: string): Promise<BrevoHttpResponse> {
    this.calls.push({ path, body, apiKey });
    return Promise.resolve(this.response);
  }
}

function emailMessage(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    channel: "email",
    to: "client@example.com",
    subject: "Booking confirmed",
    html: "<p>Hi</p>",
    text: "Hi",
    ...overrides,
  };
}

function makeProvider(http: BrevoHttpAdapter, fromName?: string): BrevoMessageProvider {
  return new BrevoMessageProvider({
    http,
    apiKey: "xkeysib-test",
    fromEmail: "no-reply@tenant.example",
    ...(fromName !== undefined ? { fromName } : {}),
  });
}

describe("BrevoMessageProvider", () => {
  it("exposes the provider name 'brevo'", () => {
    expect(makeProvider(new RecordingBrevoHttp()).name).toBe("brevo");
  });

  it("sends an email with Brevo's wire shape and the configured sender", async () => {
    const http = new RecordingBrevoHttp();
    const provider = makeProvider(http, "Tenant");
    const result = await provider.send("t1", emailMessage());

    expect(result).toEqual({ ok: true, providerId: "msg_default" });
    expect(http.calls).toHaveLength(1);
    const call = http.calls[0];
    expect(call?.path).toBe("/v3/smtp/email");
    expect(call?.apiKey).toBe("xkeysib-test");
    expect(call?.body).toEqual({
      sender: { email: "no-reply@tenant.example", name: "Tenant" },
      to: [{ email: "client@example.com" }],
      subject: "Booking confirmed",
      htmlContent: "<p>Hi</p>",
      textContent: "Hi",
    });
  });

  it("omits textContent when the message has no text part", async () => {
    const http = new RecordingBrevoHttp();
    const provider = makeProvider(http);
    await provider.send("t1", emailMessage({ text: undefined }));
    expect(http.calls[0]?.body).not.toHaveProperty("textContent");
  });

  it("lets a per-message from override the configured sender", async () => {
    const http = new RecordingBrevoHttp();
    const provider = makeProvider(http, "Tenant");
    await provider.send("t1", emailMessage({ from: "ana@tenant.example" }));
    expect(http.calls[0]?.body).toMatchObject({ sender: { email: "ana@tenant.example" } });
  });

  it("maps a Brevo error response to a failed result", async () => {
    const http = new RecordingBrevoHttp();
    http.response = {
      status: 400,
      data: { code: "invalid_parameter", message: "email is invalid" },
    };
    const result = await makeProvider(http).send("t1", emailMessage());
    expect(result).toEqual({ ok: false, error: "invalid_parameter: email is invalid" });
  });

  it("maps a transport connection error to a failed result", async () => {
    const http = new RecordingBrevoHttp();
    http.response = { status: 0, data: { code: "connection_error", message: "network error" } };
    const result = await makeProvider(http).send("t1", emailMessage());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("connection_error");
  });

  it("returns a clear failure for SMS (email-only adapter), without calling Brevo", async () => {
    const http = new RecordingBrevoHttp();
    const sms: SmsMessage = { channel: "sms", to: "+34600000000", body: "Hi" };
    const result = await makeProvider(http).send("t1", sms);
    expect(result).toEqual({ ok: false, error: "sms-not-supported" });
    expect(http.calls).toHaveLength(0);
  });
});

describe("resolveMessageProvider", () => {
  it("returns the fake provider when no Brevo key is configured", () => {
    expect(resolveMessageProvider({}).name).toBe("fake");
    expect(resolveMessageProvider({ brevoApiKey: "" }).name).toBe("fake");
  });

  it("returns the Brevo provider when keyed with a sender", () => {
    const provider = resolveMessageProvider({
      brevoApiKey: "xkeysib-test",
      fromEmail: "no-reply@tenant.example",
    });
    expect(provider.name).toBe("brevo");
  });

  it("fails fast when a Brevo key is set without a sender", () => {
    expect(() => resolveMessageProvider({ brevoApiKey: "xkeysib-test" })).toThrow(
      /MESSAGING_FROM_EMAIL/,
    );
  });
});
