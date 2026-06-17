/**
 * Password hashing for staff accounts (ADR-0005 / ADR-0017).
 *
 * Uses Node's built-in scrypt (memory-hard KDF) to avoid a native dependency in
 * this environment (argon2 needs node-gyp). Stored format is self-describing so
 * parameters can evolve without breaking existing hashes:
 *
 *   scrypt$N$r$p$<saltB64>$<hashB64>
 *
 * Verification is constant-time. Salts are random per password.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

export function hashPassword(plain: string): string {
  if (plain.length < 8) {
    throw new Error("password must be at least 8 characters");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(plain, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${String(N)}$${String(R)}$${String(P)}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }
  const expected = Buffer.from(hashB64, "base64");
  const derived = scryptSync(plain, Buffer.from(saltB64, "base64"), expected.length, {
    N: n,
    r,
    p,
  });
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
