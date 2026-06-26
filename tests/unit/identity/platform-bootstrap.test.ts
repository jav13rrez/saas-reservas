/**
 * Unit: the first-operator bootstrap rule (FR-020) is a pure decision. Self-lock
 * takes precedence over the secret — once any operator exists the endpoint is
 * permanently closed regardless of the secret, so a leaked secret cannot mint a
 * second operator through the unauthenticated path.
 */

import { describe, expect, it } from "vitest";
import { evaluateBootstrap } from "@saas-reservas/domain/identity/platform";

describe("evaluateBootstrap", () => {
  it("allows the first operator when no operator exists and the secret matches", () => {
    expect(evaluateBootstrap({ operatorCount: 0, secretMatches: true })).toEqual({ ok: true });
  });

  it("rejects with invalid-secret on a fresh platform when the secret does not match", () => {
    expect(evaluateBootstrap({ operatorCount: 0, secretMatches: false })).toEqual({
      ok: false,
      reason: "invalid-secret",
    });
  });

  it("self-locks once an operator exists, even with the correct secret", () => {
    expect(evaluateBootstrap({ operatorCount: 1, secretMatches: true })).toEqual({
      ok: false,
      reason: "already-initialized",
    });
  });

  it("self-lock takes precedence over an invalid secret", () => {
    expect(evaluateBootstrap({ operatorCount: 3, secretMatches: false })).toEqual({
      ok: false,
      reason: "already-initialized",
    });
  });
});
