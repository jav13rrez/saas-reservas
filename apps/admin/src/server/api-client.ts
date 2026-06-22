/**
 * Server-only client for the persistent Fastify API (ADR-0018).
 *
 * Responsibilities the browser must never see:
 *   - tenant routing via the Host header (ADMIN_TENANT_HOST),
 *   - staff authentication: log in once with the configured service-account
 *     credentials, cache the opaque `staff_session` cookie, and re-authenticate
 *     transparently on a 401.
 *
 * The cached session is stashed on globalThis so it survives Next.js hot reloads
 * and is shared across route handlers in the same server process.
 */

import { apiConfig, type AdminApiConfig } from "./config";

const globalForSession = globalThis as typeof globalThis & {
  __adminStaffSession?: string;
};

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  /** Parsed JSON body on success. */
  data?: T;
  /** Error message extracted from the API response on failure. */
  error?: string;
}

/** Read the `staff_session` value from a Set-Cookie header, or null. */
function parseSessionCookie(setCookie: string | null): string | null {
  if (setCookie === null) {
    return null;
  }
  for (const part of setCookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === "staff_session") {
      return rest.join("=");
    }
  }
  return null;
}

async function login(cfg: AdminApiConfig): Promise<string> {
  const response = await fetch(`${cfg.origin}/v1/admin/sessions`, {
    method: "POST",
    // Tenant routing uses X-Forwarded-Host: `Host` is a forbidden fetch header and
    // undici drops it, so the API would otherwise route to its own host. The API
    // hook prefers X-Forwarded-Host and re-validates it against the registry.
    headers: { "x-forwarded-host": cfg.tenantHost, "content-type": "application/json" },
    body: JSON.stringify({ email: cfg.staffEmail, password: cfg.staffPassword }),
  });
  if (response.status !== 201) {
    throw new Error(
      `Staff login failed against the persistent API (HTTP ${String(response.status)}).`,
    );
  }
  const session = parseSessionCookie(response.headers.get("set-cookie"));
  if (session === null) {
    throw new Error("Staff login succeeded but no staff_session cookie was returned.");
  }
  globalForSession.__adminStaffSession = session;
  return session;
}

async function session(cfg: AdminApiConfig): Promise<string> {
  return globalForSession.__adminStaffSession ?? login(cfg);
}

async function extractError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // fall through to the generic message
  }
  return `La API persistente respondió HTTP ${String(response.status)}.`;
}

/**
 * Perform an authenticated request against the API, retrying once after a fresh
 * login when the cached session is rejected (401).
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const cfg = apiConfig();
  const send = async (cookie: string): Promise<Response> =>
    fetch(`${cfg.origin}${path}`, {
      method,
      headers: {
        // See login(): tenant routing uses X-Forwarded-Host, not the forbidden Host.
        "x-forwarded-host": cfg.tenantHost,
        cookie: `staff_session=${cookie}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  let response = await send(await session(cfg));
  if (response.status === 401) {
    // Cached session expired or was invalidated; re-authenticate once.
    globalForSession.__adminStaffSession = undefined;
    response = await send(await login(cfg));
  }

  if (response.status === 204) {
    return { ok: true, status: 204 };
  }
  if (!response.ok) {
    return { ok: false, status: response.status, error: await extractError(response) };
  }
  return { ok: true, status: response.status, data: (await response.json()) as T };
}

export function apiGet<T>(path: string): Promise<ApiResult<T>> {
  return request<T>("GET", path);
}

export function apiSend<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  return request<T>(method, path, body);
}
