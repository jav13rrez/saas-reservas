import { z } from "zod";

/**
 * Environment configuration contract shared by the API, workers, and tooling.
 *
 * Constitution constraints encoded here:
 * - Secrets arrive only via environment variables and are never defaulted in code.
 * - Storage and Redis configuration exist so tenant-namespaced keys/paths
 *   (`tenant:{tenant_id}:...`, `tenants/{tenant_id}/...`) always have a real backend.
 */

const nodeEnvSchema = z.enum(["development", "test", "production"]);

export const environmentSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),

  // HTTP API
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  /** Base domain used to resolve tenant subdomains, e.g. `reservas.example`. */
  PLATFORM_BASE_DOMAIN: z.string().min(1),

  // PostgreSQL (shared database, RLS-enforced tenancy)
  DATABASE_URL: z.url(),

  // Redis (locks, queues, cache, short-lived coordination)
  REDIS_URL: z.url(),

  // Session / token signing secrets (core auth — always required).
  /** Signing secret for customer passwordless link tokens. */
  PASSWORDLESS_TOKEN_SECRET: z.string().min(32),
  /** Signing secret for session cookies. */
  SESSION_COOKIE_SECRET: z.string().min(32),

  // --- Optional until the corresponding feature is wired in the bootstrap ---
  // Validation still applies when a value IS provided, so a misconfigured
  // integration fails fast rather than silently using a weak/blank value.

  // S3/GCS-compatible object storage (file attachments). STORAGE_REGION keeps a
  // default; the rest are optional until the attachment pipeline is wired.
  STORAGE_ENDPOINT: z.url().optional(),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),

  /** Root key for envelope encryption of tenant integration credentials. */
  CREDENTIALS_MASTER_KEY: z.string().min(32).optional(),

  // Stripe (platform-level Connect). Optional until the payment gateway is wired;
  // when STRIPE_SECRET_KEY is present, main.ts selects the real Stripe adapter.
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  /** Platform application fee in basis points for destination charges (200 = 2%). */
  STRIPE_APPLICATION_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
  /** Override Stripe's API base URL (e.g. a local mock for smoke tests). */
  STRIPE_API_BASE_URL: z.url().optional(),

  // Messaging (Brevo transactional email). Optional until messaging is wired;
  // when BREVO_API_KEY is present, the messaging factory selects the Brevo
  // adapter (email only for now), otherwise the deterministic fake is used.
  BREVO_API_KEY: z.string().min(1).optional(),
  /** Default From: address for transactional email (a Brevo-verified sender). */
  MESSAGING_FROM_EMAIL: z.email().optional(),
  /** Display name paired with MESSAGING_FROM_EMAIL. */
  MESSAGING_FROM_NAME: z.string().min(1).optional(),
  /** Override Brevo's API base URL (e.g. a local mock for smoke tests). */
  BREVO_API_BASE_URL: z.url().optional(),

  // Observability
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type Environment = z.infer<typeof environmentSchema>;
export type NodeEnv = z.infer<typeof nodeEnvSchema>;

/**
 * Parse and validate process environment. Fails fast with a readable report so a
 * misconfigured deployment never boots with partial tenant-safety configuration.
 */
export function loadEnvironment(source: Record<string, string | undefined>): Environment {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    const report = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${report}`);
  }
  return result.data;
}
