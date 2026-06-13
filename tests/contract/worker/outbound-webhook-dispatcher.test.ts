/**
 * Outbound webhook dispatcher tests (T075).
 *
 * Verifies: HMAC signature header, successful dispatch, retry on failure,
 * exhausted retry policy, tenant isolation in subscriptions, and no
 * dispatch when no subscribers match.
 */

import { describe, it, expect } from "vitest";
import {
  OutboundWebhookDispatcher,
  InMemoryWebhookSubscriptionStore,
  FakeHttpDispatcher,
  signPayload,
  type WebhookPayload,
} from "@saas-reservas/worker/jobs/outbound-webhook-dispatcher";

function makePayload(overrides: Partial<WebhookPayload> = {}): WebhookPayload {
  return {
    id: "evt_001",
    tenantId: "t1",
    event: "booking.confirmed",
    occurredAt: "2026-06-13T15:00:00Z",
    data: { bookingId: "bk_1" },
    ...overrides,
  };
}

function noSleep(): Promise<void> {
  return Promise.resolve();
}

describe("OutboundWebhookDispatcher", () => {
  describe("signature", () => {
    it("sets X-Signature-256 header with sha256= prefix", async () => {
      const store = new InMemoryWebhookSubscriptionStore();
      store.add({
        id: "sub_1",
        tenantId: "t1",
        url: "https://endpoint.example.com/hook",
        secret: "my-secret",
        events: ["booking.confirmed"],
        active: true,
      });
      const http = new FakeHttpDispatcher();
      const dispatcher = new OutboundWebhookDispatcher(
        store,
        http,
        { maxAttempts: 1, baseDelayMs: 0, backoffFactor: 1 },
        noSleep,
      );

      const payload = makePayload();
      await dispatcher.dispatch(payload);

      expect(http.calls).toHaveLength(1);
      const call = http.calls[0];
      const body = call.body;
      const expectedSig = signPayload(body, "my-secret");
      expect(call.headers["X-Signature-256"]).toBe(`sha256=${expectedSig}`);
    });
  });

  describe("successful dispatch", () => {
    it("returns success with 1 attempt on 200 response", async () => {
      const store = new InMemoryWebhookSubscriptionStore();
      store.add({
        id: "sub_1",
        tenantId: "t1",
        url: "https://hook.example.com",
        secret: "secret",
        events: ["booking.confirmed"],
        active: true,
      });
      const http = new FakeHttpDispatcher();
      const dispatcher = new OutboundWebhookDispatcher(
        store,
        http,
        { maxAttempts: 3, baseDelayMs: 0, backoffFactor: 1 },
        noSleep,
      );
      const results = await dispatcher.dispatch(makePayload());
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].attempts).toBe(1);
    });

    it("dispatches to all active subscribers matching the event", async () => {
      const store = new InMemoryWebhookSubscriptionStore();
      store.add({
        id: "sub_a",
        tenantId: "t1",
        url: "https://a.example.com",
        secret: "sa",
        events: ["booking.confirmed"],
        active: true,
      });
      store.add({
        id: "sub_b",
        tenantId: "t1",
        url: "https://b.example.com",
        secret: "sb",
        events: ["booking.confirmed"],
        active: true,
      });
      const http = new FakeHttpDispatcher();
      const dispatcher = new OutboundWebhookDispatcher(store, http, undefined, noSleep);
      const results = await dispatcher.dispatch(makePayload());
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe("retry policy", () => {
    it("retries on non-2xx response and succeeds on second attempt", async () => {
      const store = new InMemoryWebhookSubscriptionStore();
      store.add({
        id: "sub_1",
        tenantId: "t1",
        url: "https://retry.example.com",
        secret: "sec",
        events: ["booking.confirmed"],
        active: true,
      });
      const http = new FakeHttpDispatcher();
      let callCount = 0;
      http.onUrl("https://retry.example.com", () => {
        callCount += 1;
        return { status: callCount === 1 ? 503 : 200 };
      });
      const dispatcher = new OutboundWebhookDispatcher(
        store,
        http,
        { maxAttempts: 3, baseDelayMs: 0, backoffFactor: 1 },
        noSleep,
      );
      const results = await dispatcher.dispatch(makePayload());
      expect(results[0].success).toBe(true);
      expect(results[0].attempts).toBe(2);
    });

    it("marks as failed after exhausting all retries", async () => {
      const store = new InMemoryWebhookSubscriptionStore();
      store.add({
        id: "sub_1",
        tenantId: "t1",
        url: "https://fail.example.com",
        secret: "sec",
        events: ["booking.confirmed"],
        active: true,
      });
      const http = new FakeHttpDispatcher();
      http.setDefaultStatus(500);
      const dispatcher = new OutboundWebhookDispatcher(
        store,
        http,
        { maxAttempts: 3, baseDelayMs: 0, backoffFactor: 1 },
        noSleep,
      );
      const results = await dispatcher.dispatch(makePayload());
      expect(results[0].success).toBe(false);
      expect(results[0].attempts).toBe(3);
      expect(http.calls).toHaveLength(3);
    });
  });

  describe("tenant isolation", () => {
    it("does not dispatch to subscriptions of other tenants", async () => {
      const store = new InMemoryWebhookSubscriptionStore();
      store.add({
        id: "sub_t2",
        tenantId: "t2",
        url: "https://t2.example.com",
        secret: "sec",
        events: ["booking.confirmed"],
        active: true,
      });
      const http = new FakeHttpDispatcher();
      const dispatcher = new OutboundWebhookDispatcher(store, http, undefined, noSleep);
      // Dispatch for t1 — t2 subscriber should not be called
      const results = await dispatcher.dispatch(makePayload({ tenantId: "t1" }));
      expect(results).toHaveLength(0);
      expect(http.calls).toHaveLength(0);
    });
  });

  describe("event filtering", () => {
    it("skips inactive subscriptions", async () => {
      const store = new InMemoryWebhookSubscriptionStore();
      store.add({
        id: "sub_inactive",
        tenantId: "t1",
        url: "https://dead.example.com",
        secret: "sec",
        events: ["booking.confirmed"],
        active: false,
      });
      const http = new FakeHttpDispatcher();
      const dispatcher = new OutboundWebhookDispatcher(store, http, undefined, noSleep);
      const results = await dispatcher.dispatch(makePayload());
      expect(results).toHaveLength(0);
    });

    it("skips subscriptions not matching the event type", async () => {
      const store = new InMemoryWebhookSubscriptionStore();
      store.add({
        id: "sub_1",
        tenantId: "t1",
        url: "https://example.com",
        secret: "sec",
        events: ["payment.captured"],
        active: true,
      });
      const http = new FakeHttpDispatcher();
      const dispatcher = new OutboundWebhookDispatcher(store, http, undefined, noSleep);
      const results = await dispatcher.dispatch(makePayload({ event: "booking.confirmed" }));
      expect(results).toHaveLength(0);
    });
  });

  describe("signPayload", () => {
    it("is deterministic for the same inputs", () => {
      const sig1 = signPayload("body", "secret");
      const sig2 = signPayload("body", "secret");
      expect(sig1).toBe(sig2);
    });

    it("differs for different secrets", () => {
      expect(signPayload("body", "secret1")).not.toBe(signPayload("body", "secret2"));
    });
  });
});
