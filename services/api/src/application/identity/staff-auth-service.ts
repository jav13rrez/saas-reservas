/**
 * Staff authentication (ADR-0005 / ADR-0017): tenant-scoped email + password
 * accounts exchanged for opaque, server-side sessions delivered via a secure
 * HttpOnly `staff_session` cookie. Deliberately separate from customer
 * passwordless access — the two session models never interchange.
 *
 * Account records are durable (StaffAccountStore port). Sessions are held in
 * memory here, mirroring the customer passwordless service; a persistent
 * session store can replace the map without touching callers.
 */

import { randomUUID } from "node:crypto";
import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import {
  normalizeStaffEmail,
  validateStaffAccount,
  type StaffAccount,
  type StaffRole,
} from "@saas-reservas/domain/identity/staff";
import type { EventSink } from "../events.js";
import { hashPassword, verifyPassword } from "./password.js";

export interface StaffAccountStore {
  insert(account: StaffAccount): Promise<void>;
  findByEmail(tenantId: string, email: string): Promise<StaffAccount | null>;
  findById(tenantId: string, staffId: string): Promise<StaffAccount | null>;
}

export interface StaffSession {
  sessionId: string;
  tenantId: string;
  staffId: string;
  role: StaffRole;
  expiresAt: Date;
}

export interface StaffSessionCookie {
  name: "staff_session";
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: "Lax";
  path: "/";
  maxAgeSeconds: number;
}

export type StaffLoginResult =
  | { ok: true; session: StaffSession; cookie: StaffSessionCookie }
  | { ok: false; reason: "invalid-credentials" | "inactive" };

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export class StaffAuthService {
  private readonly sessions = new Map<string, StaffSession>();

  constructor(
    private readonly accounts: StaffAccountStore,
    private readonly events: EventSink,
    private readonly options: { sessionTtlSeconds?: number } = {},
  ) {}

  /** Creates a staff account, hashing the password. Audited. */
  async createAccount(input: {
    tenantId: string;
    email: string;
    password: string;
    role: StaffRole;
    actor: Actor;
  }): Promise<StaffAccount> {
    const account: StaffAccount = {
      id: randomUUID(),
      tenantId: input.tenantId,
      email: normalizeStaffEmail(input.email),
      passwordHash: hashPassword(input.password),
      role: input.role,
      status: "active",
    };
    validateStaffAccount(account);
    await this.accounts.insert(account);
    await this.audit(input.tenantId, input.actor, "identity.staff-account-created", account.id, {
      role: account.role,
    });
    return account;
  }

  /** Verifies credentials and mints a session. Audited on success. */
  async authenticate(input: {
    tenantId: string;
    email: string;
    password: string;
    now?: Date;
  }): Promise<StaffLoginResult> {
    const account = await this.accounts.findByEmail(
      input.tenantId,
      normalizeStaffEmail(input.email),
    );
    // Verify against a found hash, or a throwaway to keep timing uniform.
    const hash = account?.passwordHash ?? PLACEHOLDER_HASH;
    const passwordOk = verifyPassword(input.password, hash);
    if (account === null || !passwordOk) {
      return { ok: false, reason: "invalid-credentials" };
    }
    if (account.status !== "active") {
      return { ok: false, reason: "inactive" };
    }

    const now = input.now ?? new Date();
    const sessionTtl = this.options.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
    const session: StaffSession = {
      sessionId: randomUUID(),
      tenantId: account.tenantId,
      staffId: account.id,
      role: account.role,
      expiresAt: new Date(now.getTime() + sessionTtl * 1000),
    };
    this.sessions.set(session.sessionId, session);
    await this.audit(
      account.tenantId,
      { type: "staff", id: account.id },
      "identity.staff-session-created",
      account.id,
    );
    return {
      ok: true,
      session,
      cookie: {
        name: "staff_session",
        value: session.sessionId,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        maxAgeSeconds: sessionTtl,
      },
    };
  }

  /** Resolves an opaque session id; the tenant must match the request tenant. */
  getSession(sessionId: string, tenantId: string, now: Date = new Date()): StaffSession | null {
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

  logout(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private async audit(
    tenantId: string,
    actor: Actor,
    action: string,
    staffId: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const event = createDomainEvent({
      tenantId,
      type: action,
      actor,
      payload: { entityId: staffId },
    });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action,
        entityType: "staff-account",
        entityId: staffId,
        ...(metadata ? { metadata } : {}),
      }),
    );
  }
}

/** A valid scrypt hash of a random secret, used to equalize failed-login timing. */
const PLACEHOLDER_HASH = hashPassword(randomUUID());
