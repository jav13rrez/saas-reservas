/**
 * Outbound webhook subscriptions and retry policy (T075).
 *
 * When a domain event occurs (booking confirmed, cancelled, etc.) the
 * dispatcher POSTs a signed payload to each active subscriber endpoint.
 * Signature: HMAC-SHA256 of the raw body with the subscriber's secret,
 * delivered in the X-Signature-256 header ("sha256=<hex>").
 * Retry policy: up to 3 attempts with exponential back-off (1s, 4s, 16s).
 */

import { createHmac } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "booking.rejected"
  | "payment.captured"
  | "payment.refunded"
  | "waitlist.promoted";

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
}

export interface WebhookPayload {
  id: string;
  tenantId: string;
  event: WebhookEventType;
  occurredAt: string;
  data: unknown;
}

export interface DispatchResult {
  subscriptionId: string;
  success: boolean;
  attempts: number;
  lastStatusCode?: number | undefined;
  error?: string | undefined;
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

export interface WebhookSubscriptionStore {
  findByTenantAndEvent(tenantId: string, event: WebhookEventType): Promise<WebhookSubscription[]>;
}

export interface HttpDispatcher {
  post(url: string, body: string, headers: Record<string, string>): Promise<{ status: number }>;
}

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  backoffFactor: number;
}

const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  backoffFactor: 4,
};

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export class OutboundWebhookDispatcher {
  constructor(
    private readonly subscriptions: WebhookSubscriptionStore,
    private readonly http: HttpDispatcher,
    private readonly retry: RetryPolicy = DEFAULT_RETRY,
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {}

  async dispatch(payload: WebhookPayload): Promise<DispatchResult[]> {
    const subs = await this.subscriptions.findByTenantAndEvent(payload.tenantId, payload.event);
    return Promise.all(subs.map((sub) => this.dispatchToSubscription(sub, payload)));
  }

  private async dispatchToSubscription(
    sub: WebhookSubscription,
    payload: WebhookPayload,
  ): Promise<DispatchResult> {
    const body = JSON.stringify(payload);
    const signature = signPayload(body, sub.secret);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Signature-256": `sha256=${signature}`,
      "X-Webhook-Id": payload.id,
      "X-Tenant-Id": payload.tenantId,
    };

    let lastStatus: number | undefined;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt++) {
      try {
        const result = await this.http.post(sub.url, body, headers);
        lastStatus = result.status;
        if (result.status >= 200 && result.status < 300) {
          return {
            subscriptionId: sub.id,
            success: true,
            attempts: attempt,
            lastStatusCode: result.status,
          };
        }
        lastError = `HTTP ${result.status.toString()}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "network error";
      }

      if (attempt < this.retry.maxAttempts) {
        const delayMs = this.retry.baseDelayMs * Math.pow(this.retry.backoffFactor, attempt - 1);
        await this.sleep(delayMs);
      }
    }

    return {
      subscriptionId: sub.id,
      success: false,
      attempts: this.retry.maxAttempts,
      lastStatusCode: lastStatus,
      error: lastError,
    };
  }
}

// ---------------------------------------------------------------------------
// Signature helper (exported for subscriber verification)
// ---------------------------------------------------------------------------

export function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

// ---------------------------------------------------------------------------
// In-memory stores for tests
// ---------------------------------------------------------------------------

export class InMemoryWebhookSubscriptionStore implements WebhookSubscriptionStore {
  private subscriptions: WebhookSubscription[] = [];

  add(sub: WebhookSubscription): void {
    this.subscriptions.push(sub);
  }

  findByTenantAndEvent(tenantId: string, event: WebhookEventType): Promise<WebhookSubscription[]> {
    const matches = this.subscriptions.filter(
      (s) => s.tenantId === tenantId && s.active && s.events.includes(event),
    );
    return Promise.resolve(matches);
  }
}

export class FakeHttpDispatcher implements HttpDispatcher {
  readonly calls: { url: string; body: string; headers: Record<string, string> }[] = [];
  private readonly handlers = new Map<string, () => { status: number }>();
  private defaultStatus = 200;

  onUrl(url: string, fn: () => { status: number }): void {
    this.handlers.set(url, fn);
  }

  setDefaultStatus(status: number): void {
    this.defaultStatus = status;
  }

  post(url: string, body: string, headers: Record<string, string>): Promise<{ status: number }> {
    this.calls.push({ url, body, headers });
    const handler = this.handlers.get(url);
    return Promise.resolve(handler ? handler() : { status: this.defaultStatus });
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
