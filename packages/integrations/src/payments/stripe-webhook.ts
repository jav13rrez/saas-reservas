/**
 * Stripe webhook signature verification (constitution principle IV: integration
 * security lives in the adapter, before events reach the generic processor).
 *
 * Implements Stripe's scheme: the `Stripe-Signature` header carries a timestamp
 * `t` and one or more `v1` HMAC-SHA256 signatures over `${t}.${rawBody}`, keyed
 * by the endpoint's signing secret (`whsec_…`). We recompute the HMAC over the
 * EXACT raw request body (re-serialized JSON would not match) and compare in
 * constant time, rejecting stale timestamps to blunt replay.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface StripeSignatureOptions {
  /** Max age of the signed timestamp, in seconds (Stripe default 300). */
  toleranceSeconds?: number;
  /** Injectable clock for deterministic tests. */
  nowMs?: number;
}

/** Parse a `Stripe-Signature` header into its timestamp and v1 signatures. */
function parseHeader(header: string): { t: string | undefined; v1: string[] } {
  let t: string | undefined;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t") t = value;
    else if (key === "v1") v1.push(value);
  }
  return { t, v1 };
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Stripe webhook signature over the raw request body. Returns true only
 * when the timestamp is within tolerance and a v1 signature matches the secret.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  options: StripeSignatureOptions = {},
): boolean {
  if (signatureHeader === undefined || signatureHeader.length === 0 || secret.length === 0) {
    return false;
  }
  const { t, v1 } = parseHeader(signatureHeader);
  if (t === undefined || v1.length === 0) {
    return false;
  }
  const timestamp = Number.parseInt(t, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const toleranceSeconds = options.toleranceSeconds ?? 300;
  const nowSeconds = (options.nowMs ?? Date.now()) / 1000;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return v1.some((candidate) => constantTimeEquals(expected, candidate));
}
