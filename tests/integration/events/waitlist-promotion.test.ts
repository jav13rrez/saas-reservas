/**
 * T053: waitlist priority, claim-token TTL, expiration, and automatic
 * promotion of the next candidate (spec US4 scenario 2).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";
import {
  InMemoryWaitlistStore,
  WaitlistService,
} from "@saas-reservas/api/application/events/waitlist-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";

const TENANT = "00000000-0000-4000-8000-000000000001";
const EVENT = "evt-1";
const actor = SYSTEM_ACTOR;
const NOW = new Date("2026-07-01T10:00:00Z");

describe("waitlist promotion", () => {
  let store: InMemoryWaitlistStore;
  let events: InMemoryEventSink;
  let waitlist: WaitlistService;

  beforeEach(() => {
    store = new InMemoryWaitlistStore();
    events = new InMemoryEventSink();
    waitlist = new WaitlistService(store, events, { claimTtlSeconds: 600 });
  });

  it("offers the freed seat to the highest-priority waiting entry with a TTL token", async () => {
    await waitlist.join({
      tenantId: TENANT,
      eventId: EVENT,
      customerId: "cus-low",
      priorityScore: 1,
      actor,
    });
    await waitlist.join({
      tenantId: TENANT,
      eventId: EVENT,
      customerId: "cus-high",
      priorityScore: 5,
      actor,
    });

    const offer = await waitlist.promoteNext({ tenantId: TENANT, eventId: EVENT, now: NOW });
    expect(offer?.entry.customerId).toBe("cus-high");
    expect(offer?.entry.status).toBe("offered");
    expect(offer?.entry.claimExpiresAt).toBe(new Date(NOW.getTime() + 600_000).toISOString());
    // The raw token is never persisted, only its hash.
    expect(offer?.entry.claimTokenHash).not.toBe(offer?.claimToken);
    expect(events.audits.map((a) => a.action)).toContain("waitlist.offered");
    expect(JSON.stringify(events.audits)).not.toContain(offer?.claimToken ?? "never");
  });

  it("approves a claim with the valid token within the TTL, exactly once", async () => {
    await waitlist.join({ tenantId: TENANT, eventId: EVENT, customerId: "cus-1", actor });
    const offer = await waitlist.promoteNext({ tenantId: TENANT, eventId: EVENT, now: NOW });
    if (offer === null) {
      throw new Error("expected an offer");
    }

    const wrong = await waitlist.claim({
      tenantId: TENANT,
      eventId: EVENT,
      claimToken: "bogus",
      now: NOW,
    });
    expect(wrong).toEqual({ ok: false, reason: "invalid-token" });

    const inTime = new Date(NOW.getTime() + 300_000);
    const claimed = await waitlist.claim({
      tenantId: TENANT,
      eventId: EVENT,
      claimToken: offer.claimToken,
      now: inTime,
    });
    expect(claimed.ok).toBe(true);
    if (claimed.ok) {
      expect(claimed.entry.status).toBe("approved");
    }
    // A second claim with the same token finds no offered entry.
    const replay = await waitlist.claim({
      tenantId: TENANT,
      eventId: EVENT,
      claimToken: offer.claimToken,
      now: inTime,
    });
    expect(replay).toEqual({ ok: false, reason: "invalid-token" });
  });

  it("rejects claims after the TTL", async () => {
    await waitlist.join({ tenantId: TENANT, eventId: EVENT, customerId: "cus-1", actor });
    const offer = await waitlist.promoteNext({ tenantId: TENANT, eventId: EVENT, now: NOW });
    if (offer === null) {
      throw new Error("expected an offer");
    }
    const tooLate = new Date(NOW.getTime() + 601_000);
    expect(
      await waitlist.claim({
        tenantId: TENANT,
        eventId: EVENT,
        claimToken: offer.claimToken,
        now: tooLate,
      }),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("expires stale offers and automatically promotes the next candidate", async () => {
    await waitlist.join({
      tenantId: TENANT,
      eventId: EVENT,
      customerId: "cus-first",
      priorityScore: 5,
      actor,
    });
    await waitlist.join({
      tenantId: TENANT,
      eventId: EVENT,
      customerId: "cus-second",
      priorityScore: 3,
      actor,
    });
    const first = await waitlist.promoteNext({ tenantId: TENANT, eventId: EVENT, now: NOW });
    expect(first?.entry.customerId).toBe("cus-first");

    // The job runs after the TTL: the first offer expires, the second is made.
    const afterTtl = new Date(NOW.getTime() + 601_000);
    const result = await waitlist.expireOffers({ tenantId: TENANT, eventId: EVENT, now: afterTtl });
    expect(result.expired.map((entry) => entry.customerId)).toEqual(["cus-first"]);
    expect(result.promoted.map((offer) => offer.entry.customerId)).toEqual(["cus-second"]);

    // The expired customer's token no longer works; the new one does.
    expect(
      (
        await waitlist.claim({
          tenantId: TENANT,
          eventId: EVENT,
          claimToken: first?.claimToken ?? "",
          now: afterTtl,
        })
      ).ok,
    ).toBe(false);
    const newOffer = result.promoted[0];
    if (newOffer === undefined) {
      throw new Error("expected a promotion");
    }
    expect(
      (
        await waitlist.claim({
          tenantId: TENANT,
          eventId: EVENT,
          claimToken: newOffer.claimToken,
          now: afterTtl,
        })
      ).ok,
    ).toBe(true);
    const actions = events.audits.map((a) => a.action);
    expect(actions).toContain("waitlist.expired");
    expect(actions.filter((a) => a === "waitlist.offered")).toHaveLength(2);
  });
});
