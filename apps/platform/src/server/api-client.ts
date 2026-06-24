/**
 * Server-only client for the platform API (ADR-0022). The platform surface is a
 * tenant-less origin: requests carry no tenant Host, only the platform_session
 * cookie, which the Fastify gate validates. This module runs exclusively on the
 * server (it forwards the incoming session cookie); never import it into a client
 * component.
 *
 * For US1 it exposes session helpers and a thin authenticated fetch seam; the
 * cross-tenant operations reads (US3) build on `platformFetch`. It depends on
 * `next/headers`, which is server-only and throws if imported from the browser.
 */

import { cookies } from "next/headers";

const PLATFORM_SESSION_COOKIE = "platform_session";

/** Base origin of the Fastify API (server-to-server). */
export function apiOrigin(): string {
  return process.env.API_ORIGIN ?? "http://localhost:3001";
}

/** True when the incoming request carries a platform_session cookie. */
export async function hasPlatformSession(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(PLATFORM_SESSION_COOKIE)?.value;
  return value !== undefined && value.length > 0;
}

/**
 * Server-side fetch against the platform API, forwarding the platform_session
 * cookie. Paths are versioned API paths, e.g. `/v1/ops/tenants`.
 */
export async function platformFetch(path: string, init?: RequestInit): Promise<Response> {
  const store = await cookies();
  const session = store.get(PLATFORM_SESSION_COOKIE)?.value;
  const headers = new Headers(init?.headers);
  if (session !== undefined) {
    headers.set("cookie", `${PLATFORM_SESSION_COOKIE}=${session}`);
  }
  return fetch(`${apiOrigin()}${path}`, { ...init, headers, cache: "no-store" });
}
