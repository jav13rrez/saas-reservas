/**
 * verifyStripeSignature unit tests: a correctly signed payload over the raw body
 * passes; tampering with the body, the secret, or the signature fails; stale
 * timestamps are rejected; malformed/missing headers fail closed.
 */

import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyStripeSignature } from "@saas-reservas/integrations/payments/stripe-webhook";

const SECRET = "whsec_test_secret";
const NOW_MS = 1_750_000_000_000; // fixed clock
const T = Math.floor(NOW_MS / 1000);

function sign(rawBody: string, secret = SECRET, t = T): string {
  const sig = createHmac("sha256", secret)
    .update(`${String(t)}.${rawBody}`)
    .digest("hex");
  return `t=${String(t)},v1=${sig}`;
}

describe("verifyStripeSignature", () => {
  const body = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" });

  it("accepts a valid signature over the exact raw body", () => {
    expect(verifyStripeSignature(body, sign(body), SECRET, { nowMs: NOW_MS })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const header = sign(body);
    expect(verifyStripeSignature(body + " ", header, SECRET, { nowMs: NOW_MS })).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(verifyStripeSignature(body, sign(body), "whsec_other", { nowMs: NOW_MS })).toBe(false);
  });

  it("rejects a stale timestamp beyond tolerance", () => {
    const oldT = T - 600; // 10 minutes old, default tolerance 300s
    expect(verifyStripeSignature(body, sign(body, SECRET, oldT), SECRET, { nowMs: NOW_MS })).toBe(
      false,
    );
  });

  it("accepts an old timestamp within a widened tolerance", () => {
    const oldT = T - 600;
    expect(
      verifyStripeSignature(body, sign(body, SECRET, oldT), SECRET, {
        nowMs: NOW_MS,
        toleranceSeconds: 1200,
      }),
    ).toBe(true);
  });

  it("fails closed on a missing or malformed header", () => {
    expect(verifyStripeSignature(body, undefined, SECRET, { nowMs: NOW_MS })).toBe(false);
    expect(verifyStripeSignature(body, "", SECRET, { nowMs: NOW_MS })).toBe(false);
    expect(verifyStripeSignature(body, "t=123", SECRET, { nowMs: NOW_MS })).toBe(false);
    expect(verifyStripeSignature(body, "v1=abc", SECRET, { nowMs: NOW_MS })).toBe(false);
  });

  it("accepts when one of several v1 signatures matches (key rotation)", () => {
    const valid = createHmac("sha256", SECRET)
      .update(`${String(T)}.${body}`)
      .digest("hex");
    const header = `t=${String(T)},v1=deadbeef,v1=${valid}`;
    expect(verifyStripeSignature(body, header, SECRET, { nowMs: NOW_MS })).toBe(true);
  });
});
