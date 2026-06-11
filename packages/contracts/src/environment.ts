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

  // S3/GCS-compatible object storage
  STORAGE_ENDPOINT: z.url(),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),

  // Cryptographic material
  /** Root key for envelope encryption of tenant integration credentials. */
  CREDENTIALS_MASTER_KEY: z.string().min(32),
  /** Signing secret for customer passwordless link tokens. */
  PASSWORDLESS_TOKEN_SECRET: z.string().min(32),
  /** Signing secret for session cookies. */
  SESSION_COOKIE_SECRET: z.string().min(32),

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
