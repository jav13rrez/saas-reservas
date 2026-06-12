/**
 * T042: passwordless JWT — nonce TTL, first-use revocation, replay rejection,
 * tamper detection, and secure HttpOnly session creation (constitution
 * Security And Privacy).
 */

import { describe, expect, it } from "vitest";
import {
  CustomerPasswordlessService,
  InMemoryNonceStore,
} from "@saas-reservas/api/application/identity/customer-passwordless-service";

const TENANT = "00000000-0000-4000-8000-000000000001";
const OTHER_TENANT = "00000000-0000-4000-8000-000000000002";
const CUSTOMER = "00000000-0000-4000-8000-00000000c001";

function makeService(options?: { tokenTtlSeconds?: number; sessionTtlSeconds?: number }) {
  return new CustomerPasswordlessService(
    CustomerPasswordlessService.generateKeys(),
    new InMemoryNonceStore(),
    options,
  );
}

describe("customer passwordless access", () => {
  it("redeems a fresh token into a secure HttpOnly session bound to the tenant", async () => {
    const service = makeService();
    const token = await service.issueAccessToken({ tenantId: TENANT, customerId: CUSTOMER });
    const result = await service.redeem(token);

    if (!result.ok) {
      throw new Error(`expected success, got ${result.reason}`);
    }
    expect(result.session.tenantId).toBe(TENANT);
    expect(result.session.customerId).toBe(CUSTOMER);
    expect(result.cookie).toMatchObject({
      name: "customer_session",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });

    // The opaque session resolves for its tenant only.
    expect(service.getSession(result.cookie.value, TENANT)?.customerId).toBe(CUSTOMER);
    expect(service.getSession(result.cookie.value, OTHER_TENANT)).toBeNull();
  });

  it("revokes the nonce on first use: replays are rejected", async () => {
    const service = makeService();
    const token = await service.issueAccessToken({ tenantId: TENANT, customerId: CUSTOMER });
    expect((await service.redeem(token)).ok).toBe(true);

    const replay = await service.redeem(token);
    expect(replay).toEqual({ ok: false, reason: "replayed" });
  });

  it("rejects expired tokens after the TTL", async () => {
    const service = makeService({ tokenTtlSeconds: 60 });
    const issuedAt = new Date("2026-06-15T10:00:00Z");
    const token = await service.issueAccessToken({
      tenantId: TENANT,
      customerId: CUSTOMER,
      now: issuedAt,
    });
    const afterTtl = new Date(issuedAt.getTime() + 61_000);
    expect(await service.redeem(token, afterTtl)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects tampered payloads and tokens signed with a different key", async () => {
    const service = makeService();
    const token = await service.issueAccessToken({ tenantId: TENANT, customerId: CUSTOMER });
    const [header = "", payload = "", signature = ""] = token.split(".");

    // Tamper with the payload (swap the customer id).
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub: string;
    };
    claims.sub = "00000000-0000-4000-8000-00000000c999";
    const forgedPayload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const tampered = await service.redeem(`${header}.${forgedPayload}.${signature}`);
    expect(tampered).toEqual({ ok: false, reason: "invalid-signature" });

    // A token from another key pair never validates.
    const foreign = makeService();
    const foreignToken = await foreign.issueAccessToken({ tenantId: TENANT, customerId: CUSTOMER });
    expect((await service.redeem(foreignToken)).ok).toBe(false);

    expect(await service.redeem("not-a-jwt")).toEqual({ ok: false, reason: "malformed" });
  });

  it("expires sessions after their TTL", async () => {
    const service = makeService({ sessionTtlSeconds: 60 });
    const issuedAt = new Date("2026-06-15T10:00:00Z");
    const token = await service.issueAccessToken({
      tenantId: TENANT,
      customerId: CUSTOMER,
      now: issuedAt,
    });
    const result = await service.redeem(token, issuedAt);
    if (!result.ok) {
      throw new Error("expected success");
    }
    const later = new Date("2026-06-15T10:01:01Z");
    expect(service.getSession(result.cookie.value, TENANT, later)).toBeNull();
  });
});
