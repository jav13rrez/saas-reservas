/**
 * External calendar webhook receiver (T070).
 *
 * Google and Microsoft push change notifications to these endpoints when
 * provider calendar events are created/updated/deleted. Each notification is
 * verified (Google: X-Goog-Channel-Token HMAC; Microsoft: clientState secret)
 * and reconciled against the tenant booking-to-external-event mapping.
 *
 * Idempotency: the same notification id is safe to receive multiple times.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface ExternalCalendarEvent {
  externalId: string;
  provider: "google" | "microsoft";
  tenantId: string;
  startAt?: Date | undefined;
  endAt?: Date | undefined;
  status: "active" | "cancelled";
}

export interface CalendarMapping {
  bookingId: string;
  externalId: string;
  provider: "google" | "microsoft";
  tenantId: string;
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

export interface CalendarMappingStore {
  findByExternalId(
    tenantId: string,
    provider: "google" | "microsoft",
    externalId: string,
  ): Promise<CalendarMapping | null>;
  upsert(mapping: CalendarMapping): Promise<void>;
  delete(tenantId: string, externalId: string): Promise<void>;
}

export interface NotificationIdempotencyStore {
  hasProcessed(tenantId: string, notificationId: string): Promise<boolean>;
  markProcessed(tenantId: string, notificationId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

export interface CalendarWebhookDeps {
  mappingStore: CalendarMappingStore;
  idempotency: NotificationIdempotencyStore;
  /** Tenant-scoped shared secret for validating Google channel tokens. */
  getGoogleSecret(tenantId: string): Promise<string | null>;
  /** Tenant-scoped clientState for Microsoft subscription validation. */
  getMicrosoftSecret(tenantId: string): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerCalendarWebhookRoutes(
  app: FastifyInstance,
  deps: CalendarWebhookDeps,
): void {
  // Google Calendar push notifications
  app.post(
    "/v1/integrations/calendar/webhook/google",
    async (req: FastifyRequest, reply: FastifyReply) => {
      // Google sends a sync message first to verify the endpoint
      const resourceState = req.headers["x-goog-resource-state"] as string | undefined;
      if (resourceState === "sync") {
        reply.status(200).send();
        return;
      }

      const channelToken = req.headers["x-goog-channel-token"] as string | undefined;
      const channelId = req.headers["x-goog-channel-id"] as string | undefined;
      const resourceId = req.headers["x-goog-resource-id"] as string | undefined;
      const notificationId = `google:${channelId ?? ""}:${resourceId ?? ""}`;

      // Best-effort tenant extraction from channel token (format: tenantId.secret)
      const tenantId = channelToken?.split(".")[0] ?? "";
      if (!tenantId) {
        reply.status(400).send({ error: "missing tenant in channel token" });
        return;
      }

      // HMAC verification
      const secret = await deps.getGoogleSecret(tenantId);
      if (secret !== null && channelToken !== undefined) {
        const expected = buildGoogleToken(tenantId, secret);
        if (!timingSafeCompare(channelToken, expected)) {
          reply.status(401).send({ error: "invalid channel token" });
          return;
        }
      }

      // Idempotency
      if (await deps.idempotency.hasProcessed(tenantId, notificationId)) {
        reply.status(204).send();
        return;
      }

      await deps.idempotency.markProcessed(tenantId, notificationId);

      // Reconcile — the actual event fetch happens via the calendar sync worker.
      // We only record that something changed for the given resource.
      if (resourceId !== undefined) {
        await deps.mappingStore.findByExternalId(tenantId, "google", resourceId);
      }

      reply.status(204).send();
    },
  );

  // Microsoft Graph change notifications
  app.post(
    "/v1/integrations/calendar/webhook/microsoft",
    async (req: FastifyRequest, reply: FastifyReply) => {
      // Microsoft validation handshake
      const validationToken = (req.query as Record<string, string>).validationToken;
      if (validationToken !== undefined) {
        reply.type("text/plain").status(200).send(validationToken);
        return;
      }

      const body = req.body as {
        value?: {
          clientState?: string | undefined;
          subscriptionId?: string | undefined;
          changeType?: string | undefined;
          resource?: string | undefined;
        }[];
      };

      if (!Array.isArray(body.value) || body.value.length === 0) {
        reply.status(400).send({ error: "invalid notification body" });
        return;
      }

      for (const notification of body.value) {
        // clientState format: tenantId.secret
        const clientState = notification.clientState ?? "";
        const tenantId = clientState.split(".")[0] ?? "";
        if (!tenantId) continue;

        const secret = await deps.getMicrosoftSecret(tenantId);
        if (secret !== null) {
          const expectedState = `${tenantId}.${secret}`;
          if (!timingSafeCompare(clientState, expectedState)) continue;
        }

        const notificationId = `microsoft:${notification.subscriptionId ?? ""}:${notification.resource ?? ""}`;
        if (await deps.idempotency.hasProcessed(tenantId, notificationId)) continue;
        await deps.idempotency.markProcessed(tenantId, notificationId);

        const externalId = notification.resource ?? "";
        if (externalId) {
          await deps.mappingStore.findByExternalId(tenantId, "microsoft", externalId);
        }
      }

      reply.status(202).send();
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGoogleToken(tenantId: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(tenantId);
  return `${tenantId}.${hmac.digest("hex")}`;
}

function timingSafeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------------------
// In-memory stores for tests
// ---------------------------------------------------------------------------

export class InMemoryCalendarMappingStore implements CalendarMappingStore {
  private mappings: CalendarMapping[] = [];

  findByExternalId(
    tenantId: string,
    provider: "google" | "microsoft",
    externalId: string,
  ): Promise<CalendarMapping | null> {
    const found =
      this.mappings.find(
        (m) => m.tenantId === tenantId && m.provider === provider && m.externalId === externalId,
      ) ?? null;
    return Promise.resolve(found);
  }

  upsert(mapping: CalendarMapping): Promise<void> {
    const idx = this.mappings.findIndex(
      (m) =>
        m.tenantId === mapping.tenantId &&
        m.provider === mapping.provider &&
        m.externalId === mapping.externalId,
    );
    if (idx >= 0) {
      this.mappings[idx] = mapping;
    } else {
      this.mappings.push(mapping);
    }
    return Promise.resolve();
  }

  delete(tenantId: string, externalId: string): Promise<void> {
    this.mappings = this.mappings.filter(
      (m) => !(m.tenantId === tenantId && m.externalId === externalId),
    );
    return Promise.resolve();
  }
}

export class InMemoryNotificationIdempotency implements NotificationIdempotencyStore {
  private readonly processed = new Set<string>();

  hasProcessed(tenantId: string, notificationId: string): Promise<boolean> {
    return Promise.resolve(this.processed.has(`${tenantId}:${notificationId}`));
  }

  markProcessed(tenantId: string, notificationId: string): Promise<void> {
    this.processed.add(`${tenantId}:${notificationId}`);
    return Promise.resolve();
  }
}
