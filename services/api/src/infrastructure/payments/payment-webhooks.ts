/**
 * Payment webhook idempotency model (T038).
 *
 * Gateways retry webhooks; every event id is processed at most once per
 * tenant+gateway. Receipt and outcome are audited (constitution principle V).
 * Signature verification is gateway-specific and lives in each adapter before
 * events reach this processor.
 */

import {
  auditRecordFromEvent,
  createDomainEvent,
  SYSTEM_ACTOR,
} from "@saas-reservas/domain/audit/events";
import type { EventSink } from "../../application/events.js";

export interface WebhookEvent {
  /** Gateway-assigned event id, unique per gateway. */
  id: string;
  type: string;
  payload: unknown;
}

export interface ProcessedWebhookStore {
  /** Atomically records the event id; false when it was already recorded. */
  recordIfNew(tenantId: string, gateway: string, eventId: string): Promise<boolean>;
}

export class InMemoryProcessedWebhookStore implements ProcessedWebhookStore {
  private readonly seen = new Set<string>();

  recordIfNew(tenantId: string, gateway: string, eventId: string): Promise<boolean> {
    const key = `${tenantId}:${gateway}:${eventId}`;
    if (this.seen.has(key)) {
      return Promise.resolve(false);
    }
    this.seen.add(key);
    return Promise.resolve(true);
  }
}

export type WebhookOutcome = "processed" | "duplicate";

export class WebhookProcessor {
  constructor(
    private readonly store: ProcessedWebhookStore,
    private readonly events: EventSink,
  ) {}

  async process(
    tenantId: string,
    gateway: string,
    event: WebhookEvent,
    handler: (event: WebhookEvent) => Promise<void>,
  ): Promise<WebhookOutcome> {
    const isNew = await this.store.recordIfNew(tenantId, gateway, event.id);
    if (!isNew) {
      return "duplicate";
    }
    await handler(event);
    const domainEvent = createDomainEvent({
      tenantId,
      type: "payment.webhook-processed",
      actor: SYSTEM_ACTOR,
      payload: { gateway, eventId: event.id, eventType: event.type },
    });
    await this.events.record(
      domainEvent,
      auditRecordFromEvent(domainEvent, {
        action: "payment.webhook-processed",
        entityType: "webhook-event",
        entityId: event.id,
        metadata: { gateway, eventType: event.type },
      }),
    );
    return "processed";
  }
}
