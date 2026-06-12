/**
 * Object storage path helpers (constitution: `tenants/{tenant_id}/...` paths and
 * signed URLs with short TTLs).
 */

import { assertTenantId } from "./tenant-context.js";

/** Default TTL for signed URLs to tenant objects. Keep short by constitution. */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

/** Hard ceiling: no signed URL for tenant objects may outlive this. */
export const MAX_SIGNED_URL_TTL_SECONDS = 3600;

export class InvalidStorageSegmentError extends Error {
  constructor(segment: string) {
    super(
      `Invalid storage path segment: ${JSON.stringify(segment)}; segments must be non-empty, must not contain "/", and must not be "." or ".."`,
    );
    this.name = "InvalidStorageSegmentError";
  }
}

function assertStorageSegment(segment: string): void {
  if (
    segment.length === 0 ||
    segment.includes("/") ||
    segment.includes("\\") ||
    segment === "." ||
    segment === ".." ||
    segment.includes("\0")
  ) {
    throw new InvalidStorageSegmentError(segment);
  }
}

/** Builds `tenants/{tenant_id}/{...segments}` with path-traversal protection. */
export function tenantStoragePath(tenantId: string, ...segments: string[]): string {
  assertTenantId(tenantId);
  if (segments.length === 0) {
    throw new InvalidStorageSegmentError("");
  }
  for (const segment of segments) {
    assertStorageSegment(segment);
  }
  return ["tenants", tenantId, ...segments].join("/");
}

/** True when `objectPath` belongs to the given tenant's namespace. */
export function isPathOwnedByTenant(objectPath: string, tenantId: string): boolean {
  assertTenantId(tenantId);
  return objectPath.startsWith(`tenants/${tenantId}/`);
}

/**
 * Clamps a requested signed-URL TTL into policy bounds. Callers that need more
 * than the ceiling must re-issue URLs instead of extending them.
 */
export function clampSignedUrlTtl(requestedSeconds: number): number {
  if (!Number.isFinite(requestedSeconds) || requestedSeconds <= 0) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS;
  }
  return Math.min(Math.floor(requestedSeconds), MAX_SIGNED_URL_TTL_SECONDS);
}
