/**
 * Staff password hashing (ADR-0005 / ADR-0017): scrypt round-trip, rejection of
 * wrong passwords, and tolerance of malformed stored hashes.
 */

import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@saas-reservas/api/application/identity/password";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
    expect(verifyPassword("wrong password", stored)).toBe(false);
  });

  it("produces a self-describing scrypt hash with a random salt", () => {
    const a = hashPassword("same-password-x");
    const b = hashPassword("same-password-x");
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a).not.toEqual(b); // distinct salts
    expect(verifyPassword("same-password-x", a)).toBe(true);
    expect(verifyPassword("same-password-x", b)).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(() => hashPassword("short")).toThrow();
  });

  it("returns false for a malformed stored hash", () => {
    expect(verifyPassword("whatever", "not-a-hash")).toBe(false);
    expect(verifyPassword("whatever", "scrypt$bad")).toBe(false);
  });
});
