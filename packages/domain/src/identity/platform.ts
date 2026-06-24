/**
 * Platform operator entity (ADR-0022): a platform-global identity, distinct from
 * tenant-scoped staff and customers. Like `tenants`/`tenant_domains` it carries
 * no tenant dimension and is never subject to row-level security.
 *
 * `passwordHash` is an opaque string produced by the application layer (the
 * domain holds no crypto). The first-operator bootstrap rule lives here so it can
 * be tested without HTTP or a database (constitution principle III).
 */

export type PlatformOperatorStatus = "active" | "disabled";

export interface PlatformOperator {
  id: string;
  /** Unique platform-wide; normalized lowercase. */
  email: string;
  passwordHash: string;
  displayName: string;
  status: PlatformOperatorStatus;
}

export class InvalidPlatformOperatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPlatformOperatorError";
  }
}

/** Normalizes a platform operator email for storage and lookup (trim + lowercase). */
export function normalizePlatformEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validatePlatformOperator(operator: PlatformOperator): void {
  if (normalizePlatformEmail(operator.email).length === 0) {
    throw new InvalidPlatformOperatorError("platform operator email is required");
  }
  if (!operator.email.includes("@")) {
    throw new InvalidPlatformOperatorError("platform operator email is invalid");
  }
  if (operator.passwordHash.length === 0) {
    throw new InvalidPlatformOperatorError("platform operator password hash is required");
  }
  if (operator.displayName.trim().length === 0) {
    throw new InvalidPlatformOperatorError("platform operator display name is required");
  }
}

/**
 * Outcome of evaluating the first-operator bootstrap request (FR-020). The rule
 * is pure: callers supply whether the deploy secret matched (compared in
 * constant time at the edge) and how many operators already exist.
 *
 * Self-lock takes precedence over the secret: once any operator exists the
 * endpoint is permanently closed and returns `already-initialized` regardless of
 * the secret, so a leaked secret cannot be used to mint a second operator
 * through the unauthenticated bootstrap path.
 */
export type BootstrapDecision =
  | { ok: true }
  | { ok: false; reason: "already-initialized" }
  | { ok: false; reason: "invalid-secret" };

export function evaluateBootstrap(input: {
  operatorCount: number;
  secretMatches: boolean;
}): BootstrapDecision {
  if (input.operatorCount > 0) {
    return { ok: false, reason: "already-initialized" };
  }
  if (!input.secretMatches) {
    return { ok: false, reason: "invalid-secret" };
  }
  return { ok: true };
}
