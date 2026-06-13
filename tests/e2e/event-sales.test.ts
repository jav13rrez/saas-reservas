/**
 * US4 independent test over HTTP: recurring event with General/VIP tickets and
 * shared capacity, early-bird pricing, sellout activating the waitlist,
 * attendee cancellation promoting the first candidate with a TTL token, and
 * scope-based propagation through the admin API.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@saas-reservas/api/api/availability-routes";
import { CatalogService } from "@saas-reservas/api/application/catalog/catalog-service";
import { AvailabilityService } from "@saas-reservas/api/application/scheduling/availability-service";
import { InMemoryEventStore } from "@saas-reservas/api/application/events/event-store";
import { RecurringEventService } from "@saas-reservas/api/application/events/recurring-event-service";
import {
  InMemoryWaitlistStore,
  WaitlistService,
} from "@saas-reservas/api/application/events/waitlist-service";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";

const HOST = "studio.reservas.test";

describe("event sales with waitlist", () => {
  let app: FastifyInstance;
  let eventId: string;
  let generalId: string;
  let vipId: string;
  let firstAttendeeId: string;
  let claimToken: string;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed at call sites
  async function post<T>(url: string, payload: unknown): Promise<{ status: number; body: T }> {
    const response = await app.inject({
      method: "POST",
      url,
      headers: { host: HOST },
      payload: payload as Record<string, unknown>,
    });
    return {
      status: response.statusCode,
      body: response.body.length > 0 ? response.json<T>() : ({} as T),
    };
  }

  beforeAll(async () => {
    const store = new InMemoryStore();
    const events = new InMemoryEventSink();
    const eventStore = new InMemoryEventStore();
    app = buildApp({
      platformBaseDomain: "reservas.test",
      tenantLookup: store.tenantLookup(),
      tenantAdmin: new TenantAdminService(store, events),
      catalogService: new CatalogService(store, events),
      availability: new AvailabilityService(store),
      tenantTimezone: () => Promise.resolve("UTC"),
      events: {
        store: eventStore,
        waitlist: new WaitlistService(new InMemoryWaitlistStore(), events, {
          claimTtlSeconds: 600,
        }),
        recurring: new RecurringEventService(eventStore, events),
      },
    });
    await post("/v1/platform/tenants", {
      slug: "studio",
      displayName: "Studio",
      defaultTimezone: "UTC",
    });

    const event = await post<{ id: string }>("/v1/admin/events", {
      name: "Workshop",
      seriesId: "series-1",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T12:00:00.000Z",
      totalCapacity: 3,
    });
    eventId = event.body.id;
    const general = await post<{ id: string }>(`/v1/admin/events/${eventId}/tickets`, {
      name: "General",
      priceAmount: 2000,
      dynamicPricingRules: [{ type: "early-bird", daysBeforeStart: 14, discountPercent: 25 }],
    });
    generalId = general.body.id;
    const vip = await post<{ id: string }>(`/v1/admin/events/${eventId}/tickets`, {
      name: "VIP",
      priceAmount: 5000,
      capacity: 1,
    });
    vipId = vip.body.id;
  });

  it("sells tickets with dynamic pricing until shared capacity runs out", async () => {
    const first = await post<{ attendeeId: string; pricing: { unitFinalAmount: number } }>(
      `/v1/public/events/${eventId}/purchases`,
      { ticketTypeId: generalId, quantity: 2, customerId: "cus-1" },
    );
    expect(first.status).toBe(201);
    // Today (2026-06-12) is more than 14 days before the event: early-bird applies.
    expect(first.body.pricing.unitFinalAmount).toBe(1500);
    firstAttendeeId = first.body.attendeeId;

    const vipPurchase = await post<{ attendeeId: string }>(
      `/v1/public/events/${eventId}/purchases`,
      {
        ticketTypeId: vipId,
        customerId: "cus-2",
      },
    );
    expect(vipPurchase.status).toBe(201);

    const config = await app.inject({
      method: "GET",
      url: `/v1/public/events/${eventId}`,
      headers: { host: HOST },
    });
    expect(config.json<{ remainingCapacity: number }>().remainingCapacity).toBe(0);
  });

  it("blocks direct purchase when sold out and enrolls the customer in the waitlist", async () => {
    const soldOut = await post<{ error: string; waitlistEntryId: string }>(
      `/v1/public/events/${eventId}/purchases`,
      { ticketTypeId: generalId, customerId: "cus-waiting" },
    );
    expect(soldOut.status).toBe(409);
    expect(soldOut.body.error).toBe("event-full");
    expect(soldOut.body.waitlistEntryId).toBeDefined();
  });

  it("promotes the waitlist candidate with a TTL token when an attendee cancels", async () => {
    const cancel = await post<{
      promoted: { customerId: string; claimToken: string; claimExpiresAt: string } | null;
    }>(`/v1/public/events/${eventId}/attendees/${firstAttendeeId}/cancel`, {});
    expect(cancel.status).toBe(200);
    expect(cancel.body.promoted?.customerId).toBe("cus-waiting");
    expect(cancel.body.promoted?.claimExpiresAt).toBeDefined();
    claimToken = cancel.body.promoted?.claimToken ?? "";
    expect(claimToken).not.toBe("");
  });

  it("confirms the claimant with the token, exactly once", async () => {
    const claim = await post<{ attendeeId: string }>(
      `/v1/public/events/${eventId}/waitlist/claim`,
      {
        claimToken,
        ticketTypeId: generalId,
      },
    );
    expect(claim.status).toBe(201);

    const replay = await post<{ error: string }>(`/v1/public/events/${eventId}/waitlist/claim`, {
      claimToken,
      ticketTypeId: generalId,
    });
    expect(replay.status).toBe(401);
  });

  it("propagates series edits per scope through the admin API", async () => {
    const later = await post<{ id: string }>("/v1/admin/events", {
      name: "Workshop",
      seriesId: "series-1",
      startAt: "2026-08-08T10:00:00.000Z",
      endAt: "2026-08-08T12:00:00.000Z",
      totalCapacity: 3,
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/v1/admin/events/${eventId}`,
      headers: { host: HOST },
      payload: { scope: "this-and-future", changes: { totalCapacity: 10 } },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ updated: string[] }>().updated.sort()).toEqual(
      [eventId, later.body.id].sort(),
    );
  });
});
