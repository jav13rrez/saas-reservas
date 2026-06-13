/**
 * Customer passwordless access (T046, ADR-0005, constitution Security/Privacy):
 * signed short-lived link tokens (EdDSA/Ed25519 JWT), one-time nonces with
 * first-use revocation, and opaque server-side sessions delivered via a secure
 * HttpOnly cookie. Customer and staff auth are deliberately separate models.
 */

import {
  generateKeyPairSync,
  randomUUID,
  sign as edSign,
  verify as edVerify,
  type KeyObject,
} from "node:crypto";

export interface NonceStore {
  create(tenantId: string, nonce: string, expiresAtMs: number): Promise<void>;
  /** Atomically consumes the nonce; false when missing, expired, or already used. */
  consume(tenantId: string, nonce: string): Promise<boolean>;
}

export class InMemoryNonceStore implements NonceStore {
  private readonly nonces = new Map<string, number>();

  create(tenantId: string, nonce: string, expiresAtMs: number): Promise<void> {
    this.nonces.set(`${tenantId}:${nonce}`, expiresAtMs);
    return Promise.resolve();
  }

  consume(tenantId: string, nonce: string): Promise<boolean> {
    const key = `${tenantId}:${nonce}`;
    const expiresAt = this.nonces.get(key);
    if (expiresAt === undefined || expiresAt <= Date.now()) {
      this.nonces.delete(key);
      return Promise.resolve(false);
    }
    this.nonces.delete(key); // first use revokes
    return Promise.resolve(true);
  }
}

export interface CustomerSession {
  sessionId: string;
  tenantId: string;
  customerId: string;
  expiresAt: Date;
}

export interface SessionCookie {
  name: "customer_session";
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: "Lax";
  path: "/";
  maxAgeSeconds: number;
}

export type RedeemResult =
  | { ok: true; session: CustomerSession; cookie: SessionCookie }
  | { ok: false; reason: "malformed" | "invalid-signature" | "expired" | "replayed" };

interface TokenClaims {
  iss: string;
  tid: string; // tenant id
  sub: string; // customer id
  jti: string; // one-time nonce
  iat: number;
  exp: number;
}

const ISSUER = "saas-reservas/customer-link";

const b64url = (data: Buffer | string): string => Buffer.from(data).toString("base64url");

export class CustomerPasswordlessService {
  private readonly sessions = new Map<string, CustomerSession>();

  constructor(
    private readonly keys: { privateKey: KeyObject; publicKey: KeyObject },
    private readonly nonces: NonceStore,
    private readonly options: { tokenTtlSeconds?: number; sessionTtlSeconds?: number } = {},
  ) {}

  static generateKeys(): { privateKey: KeyObject; publicKey: KeyObject } {
    return generateKeyPairSync("ed25519");
  }

  /** Issues a signed short-lived access link token for one customer. */
  async issueAccessToken(input: {
    tenantId: string;
    customerId: string;
    now?: Date;
  }): Promise<string> {
    const ttl = this.options.tokenTtlSeconds ?? 900;
    const iat = Math.floor((input.now ?? new Date()).getTime() / 1000);
    const claims: TokenClaims = {
      iss: ISSUER,
      tid: input.tenantId,
      sub: input.customerId,
      jti: randomUUID(),
      iat,
      exp: iat + ttl,
    };
    await this.nonces.create(input.tenantId, claims.jti, claims.exp * 1000);

    const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
    const payload = b64url(JSON.stringify(claims));
    const signature = edSign(null, Buffer.from(`${header}.${payload}`), this.keys.privateKey);
    return `${header}.${payload}.${b64url(signature)}`;
  }

  /** Exchanges a link token for a session; the token is revoked on first use. */
  async redeem(token: string, now: Date = new Date()): Promise<RedeemResult> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { ok: false, reason: "malformed" };
    }
    const [header, payload, signature] = parts as [string, string, string];

    const valid = edVerify(
      null,
      Buffer.from(`${header}.${payload}`),
      this.keys.publicKey,
      Buffer.from(signature, "base64url"),
    );
    if (!valid) {
      return { ok: false, reason: "invalid-signature" };
    }

    let claims: TokenClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenClaims;
    } catch {
      return { ok: false, reason: "malformed" };
    }
    if (claims.iss !== ISSUER || typeof claims.tid !== "string" || typeof claims.sub !== "string") {
      return { ok: false, reason: "malformed" };
    }
    if (claims.exp * 1000 <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }
    if (!(await this.nonces.consume(claims.tid, claims.jti))) {
      return { ok: false, reason: "replayed" };
    }

    const sessionTtl = this.options.sessionTtlSeconds ?? 3600;
    const session: CustomerSession = {
      sessionId: randomUUID(),
      tenantId: claims.tid,
      customerId: claims.sub,
      expiresAt: new Date(now.getTime() + sessionTtl * 1000),
    };
    this.sessions.set(session.sessionId, session);
    return {
      ok: true,
      session,
      cookie: {
        name: "customer_session",
        value: session.sessionId,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        maxAgeSeconds: sessionTtl,
      },
    };
  }

  /** Resolves an opaque session id; tenant must match the request's tenant. */
  getSession(sessionId: string, tenantId: string, now: Date = new Date()): CustomerSession | null {
    const session = this.sessions.get(sessionId);
    if (session?.tenantId !== tenantId) {
      return null;
    }
    if (session.expiresAt.getTime() <= now.getTime()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }
}
