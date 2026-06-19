/**
 * StripePaymentGateway contract tests.
 *
 * Verifies the real adapter behind the PaymentGateway port: destination charges
 * with an application fee when the tenant has a connected account, plain platform
 * charges otherwise, idempotency-key propagation, decline/gateway-error mapping,
 * and refunds with transfer reversal. A recording fake HTTP stands in for Stripe.
 */

import { describe, it, expect } from "vitest";
import { StripePaymentGateway } from "@saas-reservas/integrations/payments/stripe-gateway";
import type {
  StripeHttpAdapter,
  StripeHttpResponse,
  StripeRequestOptions,
} from "@saas-reservas/integrations/payments/stripe-http";
import {
  EnvelopeCredentialVault,
  InMemoryKmsAdapter,
  InMemoryVaultStorage,
} from "@saas-reservas/integrations/security/credential-vault";

interface RecordedCall {
  path: string;
  body: Record<string, string>;
  opts: StripeRequestOptions | undefined;
}

class RecordingStripeHttp implements StripeHttpAdapter {
  readonly calls: RecordedCall[] = [];
  private responses = new Map<string, StripeHttpResponse>();

  on(path: string, response: StripeHttpResponse): void {
    this.responses.set(path, response);
  }

  post(
    path: string,
    body: Record<string, string>,
    _secretKey: string,
    opts?: StripeRequestOptions,
  ): Promise<StripeHttpResponse> {
    this.calls.push({ path, body, opts });
    return Promise.resolve(this.responses.get(path) ?? { status: 404, data: { error: {} } });
  }

  get(path: string): Promise<StripeHttpResponse> {
    return Promise.resolve(this.responses.get(path) ?? { status: 404, data: { error: {} } });
  }
}

async function makeVault(): Promise<EnvelopeCredentialVault> {
  const vault = new EnvelopeCredentialVault(new InMemoryKmsAdapter(), new InMemoryVaultStorage());
  await vault.store("platform", "stripe", "secret_key", "sk_test_platform");
  return vault;
}

describe("StripePaymentGateway", () => {
  it("exposes the gateway name 'stripe'", async () => {
    const gw = new StripePaymentGateway({
      http: new RecordingStripeHttp(),
      vault: await makeVault(),
    });
    expect(gw.name).toBe("stripe");
  });

  describe("createCharge", () => {
    it("makes a destination charge with application fee when the tenant has a connected account", async () => {
      const vault = await makeVault();
      await vault.store("t1", "stripe_connect", "account_id", "acct_connected");
      const http = new RecordingStripeHttp();
      http.on("/v1/payment_intents", {
        status: 200,
        data: { id: "pi_123", status: "succeeded" },
      });

      const gw = new StripePaymentGateway({ http, vault, applicationFeeBasisPoints: 200 });
      const result = await gw.createCharge({
        tenantId: "t1",
        amount: 10000,
        currency: "EUR",
        idempotencyKey: "cart:abc",
        paymentMethod: "pm_card_visa",
      });

      expect(result).toEqual({ ok: true, chargeId: "pi_123" });
      const call = http.calls[0];
      expect(call?.path).toBe("/v1/payment_intents");
      expect(call?.body.amount).toBe("10000");
      expect(call?.body.currency).toBe("eur");
      expect(call?.body["transfer_data[destination]"]).toBe("acct_connected");
      expect(call?.body.application_fee_amount).toBe("200");
      expect(call?.body.payment_method).toBe("pm_card_visa");
      expect(call?.body.confirm).toBe("true");
      // The cart idempotency key reaches Stripe's Idempotency-Key header.
      expect(call?.opts?.idempotencyKey).toBe("cart:abc");
    });

    it("makes a plain platform charge (no transfer/fee) when there is no connected account", async () => {
      const http = new RecordingStripeHttp();
      http.on("/v1/payment_intents", { status: 200, data: { id: "pi_solo", status: "succeeded" } });

      const gw = new StripePaymentGateway({
        http,
        vault: await makeVault(),
        applicationFeeBasisPoints: 200,
      });
      const result = await gw.createCharge({
        tenantId: "t-solo",
        amount: 5000,
        currency: "eur",
        idempotencyKey: "cart:solo",
      });

      expect(result).toEqual({ ok: true, chargeId: "pi_solo" });
      const body = http.calls[0]?.body ?? {};
      expect(body["transfer_data[destination]"]).toBeUndefined();
      expect(body.application_fee_amount).toBeUndefined();
    });

    it("treats requires_capture and processing as accepted", async () => {
      for (const status of ["requires_capture", "processing"] as const) {
        const http = new RecordingStripeHttp();
        http.on("/v1/payment_intents", { status: 200, data: { id: `pi_${status}`, status } });
        const gw = new StripePaymentGateway({ http, vault: await makeVault() });
        const result = await gw.createCharge({
          tenantId: "t1",
          amount: 100,
          currency: "eur",
          idempotencyKey: `k-${status}`,
        });
        expect(result).toEqual({ ok: true, chargeId: `pi_${status}` });
      }
    });

    it("maps a card error to a decline", async () => {
      const http = new RecordingStripeHttp();
      http.on("/v1/payment_intents", {
        status: 402,
        data: { error: { type: "card_error", code: "card_declined" } },
      });
      const gw = new StripePaymentGateway({ http, vault: await makeVault() });
      const result = await gw.createCharge({
        tenantId: "t1",
        amount: 100,
        currency: "eur",
        idempotencyKey: "k",
      });
      expect(result).toEqual({ ok: false, reason: "declined" });
    });

    it("maps a non-card API error to gateway-error", async () => {
      const http = new RecordingStripeHttp();
      http.on("/v1/payment_intents", {
        status: 500,
        data: { error: { type: "api_error" } },
      });
      const gw = new StripePaymentGateway({ http, vault: await makeVault() });
      const result = await gw.createCharge({
        tenantId: "t1",
        amount: 100,
        currency: "eur",
        idempotencyKey: "k",
      });
      expect(result).toEqual({ ok: false, reason: "gateway-error" });
    });

    it("returns gateway-error when the platform secret key is missing", async () => {
      const vault = new EnvelopeCredentialVault(
        new InMemoryKmsAdapter(),
        new InMemoryVaultStorage(),
      );
      const gw = new StripePaymentGateway({ http: new RecordingStripeHttp(), vault });
      const result = await gw.createCharge({
        tenantId: "t1",
        amount: 100,
        currency: "eur",
        idempotencyKey: "k",
      });
      expect(result).toEqual({ ok: false, reason: "gateway-error" });
    });
  });

  describe("refund", () => {
    it("reverses the transfer and claws back the fee for destination charges", async () => {
      const vault = await makeVault();
      await vault.store("t1", "stripe_connect", "account_id", "acct_connected");
      const http = new RecordingStripeHttp();
      http.on("/v1/refunds", { status: 200, data: { id: "re_1" } });

      const gw = new StripePaymentGateway({ http, vault });
      const result = await gw.refund({ tenantId: "t1", chargeId: "pi_123", amount: 2500 });

      expect(result).toEqual({ ok: true, refundId: "re_1" });
      const body = http.calls[0]?.body ?? {};
      expect(body.payment_intent).toBe("pi_123");
      expect(body.amount).toBe("2500");
      expect(body.reverse_transfer).toBe("true");
      expect(body.refund_application_fee).toBe("true");
    });

    it("omits transfer reversal for plain platform charges", async () => {
      const http = new RecordingStripeHttp();
      http.on("/v1/refunds", { status: 200, data: { id: "re_2" } });
      const gw = new StripePaymentGateway({ http, vault: await makeVault() });

      await gw.refund({ tenantId: "t-solo", chargeId: "pi_solo", amount: 100 });
      const body = http.calls[0]?.body ?? {};
      expect(body.reverse_transfer).toBeUndefined();
      expect(body.refund_application_fee).toBeUndefined();
    });

    it("maps resource_missing to charge-not-found and amount_too_large to exceeds-charge", async () => {
      const cases: [string, "charge-not-found" | "exceeds-charge"][] = [
        ["resource_missing", "charge-not-found"],
        ["amount_too_large", "exceeds-charge"],
      ];
      for (const [code, reason] of cases) {
        const http = new RecordingStripeHttp();
        http.on("/v1/refunds", { status: 400, data: { error: { code } } });
        const gw = new StripePaymentGateway({ http, vault: await makeVault() });
        const result = await gw.refund({ tenantId: "t-solo", chargeId: "pi_x", amount: 100 });
        expect(result).toEqual({ ok: false, reason });
      }
    });
  });
});
