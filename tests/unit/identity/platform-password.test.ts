/**
 * Unit: platform credential hashing/verification and uniform failure (ADR-0022,
 * reusing the scrypt KDF of ADR-0017). Failed logins never disclose whether the
 * email exists — unknown email, wrong password, and disabled account all return
 * the same generic `invalid-credentials`, and an unknown email still runs a
 * verify against a placeholder hash so timing does not leak account existence.
 */

import { describe, expect, it } from "vitest";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { PlatformAuthService } from "@saas-reservas/api/application/identity/platform-auth-service";
import { InMemoryPlatformOperatorStore } from "@saas-reservas/api/infrastructure/memory/in-memory-platform-operator-store";

function service(): PlatformAuthService {
  return new PlatformAuthService(new InMemoryPlatformOperatorStore(), new InMemoryEventSink());
}

describe("PlatformAuthService credentials", () => {
  it("stores an opaque scrypt hash, never the plaintext password", async () => {
    const auth = service();
    const operator = await auth.createOperator({
      email: "owner@platform.test",
      password: "supersecret-pw",
      displayName: "Owner",
    });
    expect(operator.passwordHash).not.toContain("supersecret-pw");
    expect(operator.passwordHash.startsWith("scrypt$")).toBe(true);
  });

  it("authenticates with the correct password and normalizes the email", async () => {
    const auth = service();
    await auth.createOperator({
      email: "Owner@Platform.test",
      password: "supersecret-pw",
      displayName: "Owner",
    });
    const result = await auth.authenticate({
      email: "owner@platform.test",
      password: "supersecret-pw",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a wrong password with the generic reason", async () => {
    const auth = service();
    await auth.createOperator({
      email: "owner@platform.test",
      password: "supersecret-pw",
      displayName: "Owner",
    });
    const result = await auth.authenticate({
      email: "owner@platform.test",
      password: "wrong-password",
    });
    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
  });

  it("rejects an unknown email with the same generic reason (no account disclosure)", async () => {
    const auth = service();
    const result = await auth.authenticate({
      email: "nobody@platform.test",
      password: "whatever-pw",
    });
    expect(result).toEqual({ ok: false, reason: "invalid-credentials" });
  });

  it("rejects duplicate operator emails", async () => {
    const auth = service();
    await auth.createOperator({
      email: "dup@platform.test",
      password: "supersecret-pw",
      displayName: "A",
    });
    await expect(
      auth.createOperator({
        email: "dup@platform.test",
        password: "another-pw-9",
        displayName: "B",
      }),
    ).rejects.toThrow();
  });

  it("mints a session that getSession resolves and logout invalidates", async () => {
    const auth = service();
    await auth.createOperator({
      email: "owner@platform.test",
      password: "supersecret-pw",
      displayName: "Owner",
    });
    const result = await auth.authenticate({
      email: "owner@platform.test",
      password: "supersecret-pw",
    });
    if (!result.ok) {
      throw new Error("expected login to succeed");
    }
    expect(auth.getSession(result.session.sessionId)).not.toBeNull();
    await auth.logout(result.session.sessionId);
    expect(auth.getSession(result.session.sessionId)).toBeNull();
  });
});
