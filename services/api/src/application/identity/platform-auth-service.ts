/**
 * Platform authentication (ADR-0022, mirroring staff auth ADR-0005 / ADR-0017):
 * a platform-global email + password identity exchanged for an opaque,
 * server-side session delivered via a secure HttpOnly `platform_session` cookie.
 *
 * Platform sessions are a DISTINCT cookie and namespace from `staff_session` and
 * customer sessions; the three are never interchangeable (constitution Security
 * & Privacy; ADR-0005). Operator records are durable (PlatformOperatorStore
 * port); sessions are held in memory here for v1, mirroring staff sessions — a
 * persistent/shared session store can replace the map without touching callers
 * (the same documented follow-up as staff auth).
 *
 * Platform-only actions (bootstrap, login, logout, operator creation) are
 * audited through the injected EventSink. There is no platform-global audit
 * table yet, so on the persistent path these writes are best-effort and logged
 * if they fail (the durable global-audit store is a recorded follow-up); the
 * in-memory sink used by tests captures them exactly.
 */

import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import {
  evaluateBootstrap,
  normalizePlatformEmail,
  validatePlatformOperator,
  type BootstrapDecision,
  type PlatformOperator,
} from "@saas-reservas/domain/identity/platform";
import type { EventSink } from "../events.js";
import { hashPassword, verifyPassword } from "./password.js";

export interface PlatformOperatorStore {
  insert(operator: PlatformOperator): Promise<void>;
  findByEmail(email: string): Promise<PlatformOperator | null>;
  count(): Promise<number>;
  list(): Promise<PlatformOperator[]>;
}

export interface PlatformSession {
  sessionId: string;
  operatorId: string;
  expiresAt: Date;
}

export interface PlatformSessionCookie {
  name: "platform_session";
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: "Lax";
  path: "/";
  maxAgeSeconds: number;
}

export type PlatformLoginResult =
  | { ok: true; session: PlatformSession; cookie: PlatformSessionCookie }
  | { ok: false; reason: "invalid-credentials" };

export type PlatformBootstrapResult =
  | { ok: true; operator: PlatformOperator }
  | { ok: false; reason: "already-initialized" | "invalid-secret" };

export class PlatformOperatorEmailTakenError extends Error {
  constructor() {
    super("platform operator email already exists");
    this.name = "PlatformOperatorEmailTakenError";
  }
}

/** Pseudo-tenant marker for platform-global audit events (no real tenant). */
const PLATFORM_AUDIT_SCOPE = "platform";

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours, matching staff sessions.

export class PlatformAuthService {
  private readonly sessions = new Map<string, PlatformSession>();

  constructor(
    private readonly operators: PlatformOperatorStore,
    private readonly events: EventSink,
    private readonly options: { sessionTtlSeconds?: number } = {},
  ) {}

  /**
   * First-operator bootstrap (FR-020). Self-locks once any operator exists and
   * only proceeds when the provided secret matches the configured one. The
   * configured secret is supplied by the route (env `PLATFORM_BOOTSTRAP_SECRET`);
   * when it is absent no secret can match, so bootstrap is closed.
   */
  async bootstrap(input: {
    providedSecret: string | undefined;
    configuredSecret: string | undefined;
    email: string;
    password: string;
    displayName: string;
  }): Promise<PlatformBootstrapResult> {
    const operatorCount = await this.operators.count();
    const secretMatches = constantTimeEquals(input.providedSecret, input.configuredSecret);
    const decision: BootstrapDecision = evaluateBootstrap({ operatorCount, secretMatches });
    if (!decision.ok) {
      return { ok: false, reason: decision.reason };
    }
    const operator = await this.createOperator(input);
    await this.audit({ type: "platform", id: operator.id }, "platform.operator.bootstrapped", operator.id);
    return { ok: true, operator };
  }

  /**
   * Creates an additional operator (requires a platform session at the route).
   * Throws PlatformOperatorEmailTakenError on a duplicate email.
   */
  async createOperator(input: {
    email: string;
    password: string;
    displayName: string;
    actor?: Actor;
  }): Promise<PlatformOperator> {
    const email = normalizePlatformEmail(input.email);
    const existing = await this.operators.findByEmail(email);
    if (existing !== null) {
      throw new PlatformOperatorEmailTakenError();
    }
    const operator: PlatformOperator = {
      id: randomUUID(),
      email,
      passwordHash: hashPassword(input.password),
      displayName: input.displayName,
      status: "active",
    };
    validatePlatformOperator(operator);
    await this.operators.insert(operator);
    if (input.actor !== undefined) {
      await this.audit(input.actor, "platform.operator.created", operator.id);
    }
    return operator;
  }

  /** Verifies credentials and mints a session. Audited on success. */
  async authenticate(input: {
    email: string;
    password: string;
    now?: Date;
  }): Promise<PlatformLoginResult> {
    const operator = await this.operators.findByEmail(normalizePlatformEmail(input.email));
    // Verify against a found hash, or a throwaway to keep failed-login timing uniform.
    const hash = operator?.passwordHash ?? PLACEHOLDER_HASH;
    const passwordOk = verifyPassword(input.password, hash);
    if (operator === null || !passwordOk || operator.status !== "active") {
      return { ok: false, reason: "invalid-credentials" };
    }

    const now = input.now ?? new Date();
    const sessionTtl = this.options.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
    const session: PlatformSession = {
      sessionId: randomUUID(),
      operatorId: operator.id,
      expiresAt: new Date(now.getTime() + sessionTtl * 1000),
    };
    this.sessions.set(session.sessionId, session);
    await this.audit({ type: "platform", id: operator.id }, "platform.operator.login", operator.id);
    return {
      ok: true,
      session,
      cookie: {
        name: "platform_session",
        value: session.sessionId,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        maxAgeSeconds: sessionTtl,
      },
    };
  }

  /** Resolves an opaque platform session id, or null when missing/expired. */
  getSession(sessionId: string, now: Date = new Date()): PlatformSession | null {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return null;
    }
    if (session.expiresAt.getTime() <= now.getTime()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  async logout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    this.sessions.delete(sessionId);
    if (session !== undefined) {
      await this.audit(
        { type: "platform", id: session.operatorId },
        "platform.operator.logout",
        session.operatorId,
      );
    }
  }

  /**
   * Records a platform-global audit event. Best-effort: there is no platform
   * audit table yet, so a persistence failure (e.g. tenant-scoped sink rejecting
   * a tenant-less write) is logged and swallowed rather than failing the action.
   */
  private async audit(actor: Actor, action: string, entityId: string): Promise<void> {
    const event = createDomainEvent({
      tenantId: PLATFORM_AUDIT_SCOPE,
      type: action,
      actor,
      payload: { entityId },
    });
    try {
      await this.events.record(
        event,
        auditRecordFromEvent(event, {
          action,
          entityType: "platform-operator",
          entityId,
        }),
      );
    } catch (error) {
      console.warn(`platform audit write failed for ${action}:`, error);
    }
  }
}

/** Constant-time secret comparison that tolerates undefined/length mismatch. */
function constantTimeEquals(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) {
    return false;
  }
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/** A valid scrypt hash of a random secret, used to equalize failed-login timing. */
const PLACEHOLDER_HASH = hashPassword(randomUUID());
