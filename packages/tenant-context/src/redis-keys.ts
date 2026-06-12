/**
 * Redis key namespace helpers (constitution: every Redis key carries tenant identity).
 *
 * Key shapes:
 *   tenant:{tenant_id}:{...segments}            general tenant-scoped keys
 *   lock:{tenant_id}:{provider}:{resource}:{startAt}   checkout/slot locks (plan.md)
 */

import { assertTenantId } from "./tenant-context.js";

/** Default TTL for checkout slot locks (plan.md: 10 minutes). */
export const DEFAULT_LOCK_TTL_SECONDS = 600;

export class InvalidKeySegmentError extends Error {
  constructor(segment: string) {
    super(
      `Invalid Redis key segment: ${JSON.stringify(segment)}; segments must be non-empty and must not contain ":" or whitespace`,
    );
    this.name = "InvalidKeySegmentError";
  }
}

function assertSegment(segment: string): void {
  if (segment.length === 0 || /[:\s]/.test(segment)) {
    throw new InvalidKeySegmentError(segment);
  }
}

/** Builds `tenant:{tenant_id}:{...segments}`. */
export function tenantKey(tenantId: string, ...segments: string[]): string {
  assertTenantId(tenantId);
  if (segments.length === 0) {
    throw new InvalidKeySegmentError("");
  }
  for (const segment of segments) {
    assertSegment(segment);
  }
  return ["tenant", tenantId, ...segments].join(":");
}

export interface SlotLockKeyInput {
  tenantId: string;
  providerId: string;
  /** Use "none" when the slot does not consume a shared resource. */
  resourceId: string;
  /** Slot start instant; serialized as ISO-8601 UTC. */
  startAt: Date;
}

/** Builds `lock:{tenant_id}:{provider_id}:{resource_id}:{start_iso}` for checkout holds. */
export function slotLockKey({
  tenantId,
  providerId,
  resourceId,
  startAt,
}: SlotLockKeyInput): string {
  assertTenantId(tenantId);
  assertSegment(providerId);
  assertSegment(resourceId);
  return ["lock", tenantId, providerId, resourceId, startAt.toISOString()].join(":");
}

/** Extracts the tenant id from a key produced by this module, or null. */
export function tenantIdFromKey(key: string): string | null {
  const [prefix, tenantId] = key.split(":");
  return (prefix === "tenant" || prefix === "lock") && tenantId !== undefined ? tenantId : null;
}
