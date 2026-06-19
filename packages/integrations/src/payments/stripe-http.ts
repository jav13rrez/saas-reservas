/**
 * Real Stripe HTTP adapter (production wiring for the Stripe Connect adapters).
 *
 * Talks to https://api.stripe.com using form-encoded bodies, Bearer auth, and
 * the Idempotency-Key header. Application code never imports the Stripe SDK; the
 * adapters in this package own the wire format behind the StripeHttpAdapter port,
 * so tests stay deterministic with a fake adapter and production swaps in fetch.
 *
 * All amounts handled by callers are integer minor units.
 */

export interface StripeHttpResponse {
  status: number;
  data: unknown;
}

export interface StripeRequestOptions {
  /** Maps to Stripe's `Idempotency-Key` header for safe retries. */
  idempotencyKey?: string | undefined;
  /** Maps to the `Stripe-Account` header for acting on a connected account. */
  stripeAccount?: string | undefined;
}

export interface StripeHttpAdapter {
  post(
    path: string,
    body: Record<string, string>,
    secretKey: string,
    opts?: StripeRequestOptions,
  ): Promise<StripeHttpResponse>;
  get(path: string, secretKey: string, opts?: StripeRequestOptions): Promise<StripeHttpResponse>;
}

const STRIPE_API_BASE = "https://api.stripe.com";

/**
 * Production Stripe transport backed by the global `fetch`. The base URL and
 * fetch implementation are injectable so unit tests can drive it without the
 * network and integration smoke tests can point at Stripe's test mode.
 */
export class FetchStripeHttp implements StripeHttpAdapter {
  constructor(
    private readonly baseUrl: string = STRIPE_API_BASE,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  post(
    path: string,
    body: Record<string, string>,
    secretKey: string,
    opts?: StripeRequestOptions,
  ): Promise<StripeHttpResponse> {
    return this.send(path, secretKey, opts, {
      method: "POST",
      body: new URLSearchParams(body).toString(),
      contentType: "application/x-www-form-urlencoded",
    });
  }

  get(path: string, secretKey: string, opts?: StripeRequestOptions): Promise<StripeHttpResponse> {
    return this.send(path, secretKey, opts, { method: "GET" });
  }

  private async send(
    path: string,
    secretKey: string,
    opts: StripeRequestOptions | undefined,
    req: { method: string; body?: string; contentType?: string },
  ): Promise<StripeHttpResponse> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${secretKey}`,
      // Pin the API version so server-side behavior is stable across deploys.
      "Stripe-Version": "2024-06-20",
    };
    if (req.contentType !== undefined) headers["Content-Type"] = req.contentType;
    if (opts?.idempotencyKey !== undefined) headers["Idempotency-Key"] = opts.idempotencyKey;
    if (opts?.stripeAccount !== undefined) headers["Stripe-Account"] = opts.stripeAccount;

    const init: RequestInit = { method: req.method, headers };
    if (req.body !== undefined) init.body = req.body;

    try {
      const resp = await this.fetchImpl(`${this.baseUrl}${path}`, init);
      const text = await resp.text();
      let data: unknown = null;
      if (text.length > 0) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: { message: "non-JSON response from Stripe", raw: text } };
        }
      }
      return { status: resp.status, data };
    } catch (err) {
      // Network/transport failure: surface as a non-2xx so callers map it to a
      // gateway error rather than throwing through the payment port.
      const message = err instanceof Error ? err.message : "network error";
      return { status: 0, data: { error: { type: "api_connection_error", message } } };
    }
  }
}
