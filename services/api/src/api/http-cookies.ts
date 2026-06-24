/**
 * Cookie helpers shared by the route modules. Kept separate so route files can
 * reuse them without import cycles (availability-routes registers platform-routes).
 */

import type { FastifyRequest } from "fastify";

/** Reads a cookie value from the request's Cookie header, or null. */
export function cookieValue(request: FastifyRequest, name: string): string | null {
  const header = request.headers.cookie;
  if (header === undefined) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return null;
}

export function serializeCookie(cookie: {
  name: string;
  value: string;
  maxAgeSeconds: number;
  path: string;
  sameSite: string;
}): string {
  return `${cookie.name}=${cookie.value}; Max-Age=${String(cookie.maxAgeSeconds)}; Path=${cookie.path}; HttpOnly; Secure; SameSite=${cookie.sameSite}`;
}
