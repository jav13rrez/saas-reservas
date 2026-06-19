/**
 * FetchStripeHttp unit tests: form-encoding, auth/idempotency headers, JSON
 * parsing, status passthrough, and network-failure handling — all with an
 * injected fetch so no real network calls happen.
 */

import { describe, it, expect } from "vitest";
import { FetchStripeHttp } from "@saas-reservas/integrations/payments/stripe-http";

interface CapturedRequest {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(captured: CapturedRequest[], response: Response | (() => never)): typeof fetch {
  const impl = (input: string | URL, init?: RequestInit): Promise<Response> => {
    captured.push({ url: input.toString(), init });
    if (typeof response === "function") return Promise.reject(new Error("ECONNREFUSED"));
    return Promise.resolve(response);
  };
  return impl as typeof fetch;
}

function headerValue(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers as Record<string, string> | undefined;
  return headers?.[name];
}

describe("FetchStripeHttp", () => {
  it("posts a form-encoded body with auth, version, and idempotency headers", async () => {
    const captured: CapturedRequest[] = [];
    const http = new FetchStripeHttp(
      "https://stripe.test",
      fakeFetch(
        captured,
        new Response(JSON.stringify({ id: "pi_1", status: "succeeded" }), { status: 200 }),
      ),
    );

    const resp = await http.post(
      "/v1/payment_intents",
      { amount: "1000", currency: "eur" },
      "sk_test_x",
      { idempotencyKey: "cart:1" },
    );

    expect(resp).toEqual({ status: 200, data: { id: "pi_1", status: "succeeded" } });
    const call = captured[0];
    expect(call?.url).toBe("https://stripe.test/v1/payment_intents");
    expect(call?.init?.method).toBe("POST");
    expect(call?.init?.body).toBe("amount=1000&currency=eur");
    expect(headerValue(call?.init, "Authorization")).toBe("Bearer sk_test_x");
    expect(headerValue(call?.init, "Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(headerValue(call?.init, "Idempotency-Key")).toBe("cart:1");
    expect(headerValue(call?.init, "Stripe-Version")).toBeDefined();
  });

  it("sends the Stripe-Account header when acting on a connected account", async () => {
    const captured: CapturedRequest[] = [];
    const http = new FetchStripeHttp(
      "https://stripe.test",
      fakeFetch(captured, new Response("{}", { status: 200 })),
    );
    await http.get("/v1/accounts/acct_1", "sk", { stripeAccount: "acct_1" });
    expect(headerValue(captured[0]?.init, "Stripe-Account")).toBe("acct_1");
  });

  it("passes through non-2xx status with the parsed error body", async () => {
    const captured: CapturedRequest[] = [];
    const http = new FetchStripeHttp(
      "https://stripe.test",
      fakeFetch(
        captured,
        new Response(JSON.stringify({ error: { code: "card_declined" } }), { status: 402 }),
      ),
    );
    const resp = await http.post("/v1/payment_intents", {}, "sk");
    expect(resp.status).toBe(402);
    expect(resp.data).toEqual({ error: { code: "card_declined" } });
  });

  it("maps a network failure to a status-0 connection error instead of throwing", async () => {
    const captured: CapturedRequest[] = [];
    const http = new FetchStripeHttp(
      "https://stripe.test",
      fakeFetch(captured, () => {
        throw new Error("unreachable");
      }),
    );
    const resp = await http.post("/v1/refunds", {}, "sk");
    expect(resp.status).toBe(0);
    expect((resp.data as { error: { type: string } }).error.type).toBe("api_connection_error");
  });
});
