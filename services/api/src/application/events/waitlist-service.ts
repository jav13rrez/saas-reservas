/**
 * Waitlist service (T058, spec US4 scenario 2): when capacity frees up, the
 * highest-priority waiting entry receives a claim token with a TTL. The raw
 * token goes only to the customer; the store keeps its SHA-256. Expired offers
 * promote the next candidate automatically (the worker job calls
 * `expireOffers` on a schedule).
 */

import { createHash, randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import {
  auditRecordFromEvent,
  createDomainEvent,
  SYSTEM_ACTOR,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import type { WaitlistEntry } from "@saas-reservas/domain/events/event";
import type { EventSink } from "../events.js";

export interface WaitlistStore {
  insertEntry(entry: WaitlistEntry): Promise<void>;
  updateEntry(entry: WaitlistEntry): Promise<void>;
  listEntries(tenantId: string, eventId: string): Promise<WaitlistEntry[]>;
}

export class InMemoryWaitlistStore implements WaitlistStore {
  private readonly entries = new Map<string, WaitlistEntry>();

  insertEntry(entry: WaitlistEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    return Promise.resolve();
  }

  updateEntry(entry: WaitlistEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    return Promise.resolve();
  }

  listEntries(tenantId: string, eventId: string): Promise<WaitlistEntry[]> {
    return Promise.resolve(
      [...this.entries.values()].filter(
        (entry) => entry.tenantId === tenantId && entry.eventId === eventId,
      ),
    );
  }
}

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export type ClaimResult =
  | { ok: true; entry: WaitlistEntry }
  | { ok: false; reason: "invalid-token" | "expired" };

export class WaitlistService {
  constructor(
    private readonly store: WaitlistStore,
    private readonly events: EventSink,
    private readonly options: { claimTtlSeconds?: number } = {},
  ) {}

  async join(input: {
    tenantId: string;
    eventId: string;
    customerId: string;
    priorityScore?: number;
    actor: Actor;
  }): Promise<WaitlistEntry> {
    const entry: WaitlistEntry = {
      id: randomUUID(),
      tenantId: input.tenantId,
      eventId: input.eventId,
      customerId: input.customerId,
      priorityScore: input.priorityScore ?? 0,
      status: "waiting",
    };
    await this.store.insertEntry(entry);
    await this.audit(input.tenantId, input.actor, "waitlist.joined", entry.id, {
      eventId: input.eventId,
    });
    return entry;
  }

  /**
   * Offers the freed seat to the best waiting candidate: highest priority
   * score, FIFO among equals (ids are time-ordered by insertion order in the
   * store listing). Returns null when nobody is waiting.
   */
  async promoteNext(input: {
    tenantId: string;
    eventId: string;
    now?: Date;
  }): Promise<{ entry: WaitlistEntry; claimToken: string } | null> {
    const entries = await this.store.listEntries(input.tenantId, input.eventId);
    const waiting = entries
      .filter((entry) => entry.status === "waiting")
      .sort((a, b) => b.priorityScore - a.priorityScore);
    const candidate = waiting[0];
    if (candidate === undefined) {
      return null;
    }

    const claimToken = randomBytes(24).toString("base64url");
    const ttlMs = (this.options.claimTtlSeconds ?? 600) * 1000;
    const offered: WaitlistEntry = {
      ...candidate,
      status: "offered",
      claimTokenHash: hashToken(claimToken),
      claimExpiresAt: new Date((input.now ?? new Date()).getTime() + ttlMs).toISOString(),
    };
    await this.store.updateEntry(offered);
    await this.audit(input.tenantId, SYSTEM_ACTOR, "waitlist.offered", offered.id, {
      eventId: input.eventId,
      claimExpiresAt: offered.claimExpiresAt ?? null,
    });
    return { entry: offered, claimToken };
  }

  /** Approves the offered entry when the token matches and has not expired. */
  async claim(input: {
    tenantId: string;
    eventId: string;
    claimToken: string;
    now?: Date;
  }): Promise<ClaimResult> {
    const now = input.now ?? new Date();
    const entries = await this.store.listEntries(input.tenantId, input.eventId);
    const tokenHash = hashToken(input.claimToken);
    const entry = entries.find(
      (candidate) => candidate.status === "offered" && candidate.claimTokenHash === tokenHash,
    );
    if (entry === undefined) {
      return { ok: false, reason: "invalid-token" };
    }
    if (entry.claimExpiresAt !== undefined && Date.parse(entry.claimExpiresAt) <= now.getTime()) {
      return { ok: false, reason: "expired" };
    }
    const approved: WaitlistEntry = { ...entry, status: "approved" };
    await this.store.updateEntry(approved);
    await this.audit(
      input.tenantId,
      { type: "customer", id: entry.customerId },
      "waitlist.approved",
      entry.id,
      {
        eventId: input.eventId,
      },
    );
    return { ok: true, entry: approved };
  }

  /**
   * Expires stale offers and promotes the next candidate for each freed seat.
   * Intended to run as a scheduled worker job. Returns the new offers made.
   */
  async expireOffers(input: { tenantId: string; eventId: string; now?: Date }): Promise<{
    expired: WaitlistEntry[];
    promoted: { entry: WaitlistEntry; claimToken: string }[];
  }> {
    const now = input.now ?? new Date();
    const entries = await this.store.listEntries(input.tenantId, input.eventId);
    const expired: WaitlistEntry[] = [];
    for (const entry of entries) {
      if (
        entry.status === "offered" &&
        entry.claimExpiresAt !== undefined &&
        Date.parse(entry.claimExpiresAt) <= now.getTime()
      ) {
        const expiredEntry: WaitlistEntry = { ...entry, status: "expired" };
        await this.store.updateEntry(expiredEntry);
        await this.audit(input.tenantId, SYSTEM_ACTOR, "waitlist.expired", entry.id, {
          eventId: input.eventId,
        });
        expired.push(expiredEntry);
      }
    }
    const promoted: { entry: WaitlistEntry; claimToken: string }[] = [];
    // One freed seat per expired offer; stop early when nobody is waiting.
    for (const _seat of expired) {
      const next = await this.promoteNext({
        tenantId: input.tenantId,
        eventId: input.eventId,
        now,
      });
      if (next === null) {
        break;
      }
      promoted.push(next);
    }
    return { expired, promoted };
  }

  private async audit(
    tenantId: string,
    actor: Actor,
    action: string,
    entryId: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const event = createDomainEvent({ tenantId, type: action, actor, payload: { entryId } });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action,
        entityType: "waitlist-entry",
        entityId: entryId,
        ...(metadata ? { metadata } : {}),
      }),
    );
  }
}
