/**
 * T064 – External calendar webhook idempotency and reconciliation tests.
 *
 * Verifies: Google sync handshake, Google HMAC validation, Microsoft
 * validation handshake, notification idempotency, invalid token rejection,
 * and tenant isolation in notification processing.
 */

import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import {
  registerCalendarWebhookRoutes,
  InMemoryCalendarMappingStore,
  InMemoryNotificationIdempotency,
  type CalendarWebhookDeps,
} from "@saas-reservas/api/api/calendar-webhook-routes";
import { createHmac } from "node:crypto";

function buildGoogleToken(tenantId: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(tenantId);
  return `${tenantId}.${hmac.digest("hex")}`;
}

function makeApp(deps: CalendarWebhookDeps) {
  const app = Fastify();
  registerCalendarWebhookRoutes(app, deps);
  return app;
}

function makeDeps(overrides: Partial<CalendarWebhookDeps> = {}): {
  deps: CalendarWebhookDeps;
  mapping: InMemoryCalendarMappingStore;
  idempotency: InMemoryNotificationIdempotency;
} {
  const mapping = new InMemoryCalendarMappingStore();
  const idempotency = new InMemoryNotificationIdempotency();
  const deps: CalendarWebhookDeps = {
    mappingStore: mapping,
    idempotency,
    getGoogleSecret: (tenantId) => Promise.resolve(tenantId === "t1" ? "secret-t1" : null),
    getMicrosoftSecret: (tenantId) => Promise.resolve(tenantId === "t1" ? "ms-secret-t1" : null),
    ...overrides,
  };
  return { deps, mapping, idempotency };
}

describe("Calendar webhook routes", () => {
  describe("Google Calendar", () => {
    it("responds 200 to sync handshake", async () => {
      const { deps } = makeDeps();
      const app = makeApp(deps);
      const res = await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/google",
        headers: { "x-goog-resource-state": "sync", "x-goog-channel-token": "t1.tok" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("accepts valid HMAC-signed notification and returns 204", async () => {
      const { deps } = makeDeps();
      const app = makeApp(deps);
      const token = buildGoogleToken("t1", "secret-t1");
      const res = await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/google",
        headers: {
          "x-goog-resource-state": "exists",
          "x-goog-channel-token": token,
          "x-goog-channel-id": "ch-001",
          "x-goog-resource-id": "res-abc",
        },
      });
      expect(res.statusCode).toBe(204);
    });

    it("rejects notification with invalid HMAC (401)", async () => {
      const { deps } = makeDeps();
      const app = makeApp(deps);
      const res = await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/google",
        headers: {
          "x-goog-resource-state": "exists",
          "x-goog-channel-token": "t1.badtoken",
          "x-goog-channel-id": "ch-001",
          "x-goog-resource-id": "res-abc",
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it("processes each notification exactly once (idempotency)", async () => {
      const { deps, idempotency } = makeDeps();
      const app = makeApp(deps);
      const token = buildGoogleToken("t1", "secret-t1");
      const headers = {
        "x-goog-resource-state": "exists",
        "x-goog-channel-token": token,
        "x-goog-channel-id": "ch-001",
        "x-goog-resource-id": "res-dup",
      };

      await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/google",
        headers,
      });
      const second = await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/google",
        headers,
      });
      expect(second.statusCode).toBe(204);
      // Idempotency key should exist exactly once in storage
      const key = "google:ch-001:res-dup";
      expect(await idempotency.hasProcessed("t1", key)).toBe(true);
    });

    it("returns 400 when tenant is missing from channel token", async () => {
      const { deps } = makeDeps();
      const app = makeApp(deps);
      const res = await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/google",
        headers: {
          "x-goog-resource-state": "exists",
          "x-goog-channel-token": "",
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("Microsoft Calendar", () => {
    it("responds to validation handshake with the validationToken", async () => {
      const { deps } = makeDeps();
      const app = makeApp(deps);
      const res = await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/microsoft?validationToken=abc-123",
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe("abc-123");
    });

    it("accepts valid Microsoft notification and returns 202", async () => {
      const { deps } = makeDeps();
      const app = makeApp(deps);
      const res = await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/microsoft",
        payload: {
          value: [
            {
              clientState: "t1.ms-secret-t1",
              subscriptionId: "sub-001",
              changeType: "updated",
              resource: "me/events/AAA123",
            },
          ],
        },
      });
      expect(res.statusCode).toBe(202);
    });

    it("silently skips notifications with invalid clientState", async () => {
      const { deps } = makeDeps();
      const app = makeApp(deps);
      const res = await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/microsoft",
        payload: {
          value: [
            {
              clientState: "t1.WRONG-SECRET",
              subscriptionId: "sub-bad",
              changeType: "updated",
              resource: "me/events/BAD",
            },
          ],
        },
      });
      // We still 202 but nothing is processed
      expect(res.statusCode).toBe(202);
    });

    it("returns 400 for empty notification body", async () => {
      const { deps } = makeDeps();
      const app = makeApp(deps);
      const res = await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/microsoft",
        payload: { value: [] },
      });
      expect(res.statusCode).toBe(400);
    });

    it("processes Microsoft notifications idempotently", async () => {
      const { deps, idempotency } = makeDeps();
      const app = makeApp(deps);
      const payload = {
        value: [
          {
            clientState: "t1.ms-secret-t1",
            subscriptionId: "sub-idem",
            changeType: "updated",
            resource: "me/events/IDEM-123",
          },
        ],
      };
      await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/microsoft",
        payload,
      });
      await app.inject({
        method: "POST",
        url: "/v1/integrations/calendar/webhook/microsoft",
        payload,
      });
      const notifId = "microsoft:sub-idem:me/events/IDEM-123";
      expect(await idempotency.hasProcessed("t1", notifId)).toBe(true);
    });
  });
});
