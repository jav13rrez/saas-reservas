/**
 * Messaging provider selection (mirrors `resolvePaymentGateway` for payments).
 *
 * Returns the real Brevo email adapter when BREVO_API_KEY is configured, else the
 * deterministic FakeMessageProvider. Framework-agnostic so any composition root
 * (the worker bootstrap, once it exists) can select a provider from env without
 * importing Fastify or the worker runtime.
 */

import { FetchBrevoHttp } from "./brevo-http.js";
import { BrevoMessageProvider } from "./brevo-message-provider.js";
import { FakeMessageProvider, type MessageProvider } from "./message-provider.js";

export interface MessagingConfig {
  brevoApiKey?: string | undefined;
  /** Verified Brevo sender; required when brevoApiKey is set. */
  fromEmail?: string | undefined;
  fromName?: string | undefined;
  /** Override Brevo's API base URL (e.g. a mock for smoke tests). */
  brevoApiBaseUrl?: string | undefined;
}

/**
 * Select the messaging provider from config. Fails fast if a Brevo key is set
 * without a sender address, so a misconfiguration surfaces at boot, not at the
 * first notification.
 */
export function resolveMessageProvider(
  config: MessagingConfig,
  fetchImpl: typeof fetch = fetch,
): MessageProvider {
  const apiKey = config.brevoApiKey;
  if (apiKey === undefined || apiKey.length === 0) {
    return new FakeMessageProvider();
  }
  if (config.fromEmail === undefined || config.fromEmail.length === 0) {
    throw new Error("MESSAGING_FROM_EMAIL is required when BREVO_API_KEY is set");
  }
  const http =
    config.brevoApiBaseUrl !== undefined
      ? new FetchBrevoHttp(config.brevoApiBaseUrl, fetchImpl)
      : new FetchBrevoHttp(undefined, fetchImpl);
  return new BrevoMessageProvider({
    http,
    apiKey,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
  });
}
