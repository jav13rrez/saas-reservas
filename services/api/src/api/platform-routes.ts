/**
 * Platform-operator routes (ADR-0022 / feature 002): first-operator bootstrap,
 * login, logout, and gated operator creation. Registered by `buildApp` only when
 * `platformAuth` is wired. The platform-auth gate (see availability-routes) makes
 * every route here except the self-locking bootstrap and login require a valid
 * `platform_session`.
 *
 * These endpoints carry no tenant (the /v1/platform/* group is exempt from
 * Host-based tenant resolution); platform identity is platform-global.
 */

import type { FastifyInstance } from "fastify";
import {
  PlatformOperatorEmailTakenError,
  type PlatformAuthService,
} from "../application/identity/platform-auth-service.js";
import { cookieValue, serializeCookie } from "./http-cookies.js";

export interface PlatformRouteDeps {
  platformAuth: PlatformAuthService;
  platformBootstrapSecret?: string;
}

export function registerPlatformRoutes(app: FastifyInstance, deps: PlatformRouteDeps): void {
  const { platformAuth } = deps;

  // First-operator bootstrap (FR-020): deploy-secret gated and self-locking.
  app.post("/v1/platform/operators/bootstrap", async (request, reply) => {
    const body = request.body as {
      secret?: string;
      email: string;
      password: string;
      displayName: string;
    };
    const result = await platformAuth.bootstrap({
      providedSecret: body.secret,
      configuredSecret: deps.platformBootstrapSecret,
      email: body.email,
      password: body.password,
      displayName: body.displayName,
    });
    if (!result.ok) {
      const status = result.reason === "already-initialized" ? 409 : 403;
      return reply.code(status).send({ error: result.reason });
    }
    return reply.code(201).send({ id: result.operator.id, email: result.operator.email });
  });

  // Login: exchange credentials for an opaque platform_session cookie.
  app.post("/v1/platform/sessions", async (request, reply) => {
    const body = request.body as { email: string; password: string };
    const result = await platformAuth.authenticate({ email: body.email, password: body.password });
    if (!result.ok) {
      return reply.code(401).send({ error: "invalid-credentials" });
    }
    return reply
      .header("set-cookie", serializeCookie(result.cookie))
      .code(200)
      .send({ operatorId: result.session.operatorId, expiresAt: result.session.expiresAt });
  });

  // Logout: invalidate the current platform session (gate ensures one exists).
  app.delete("/v1/platform/sessions", async (request, reply) => {
    const sessionId = cookieValue(request, "platform_session");
    if (sessionId !== null) {
      await platformAuth.logout(sessionId);
    }
    return reply
      .header(
        "set-cookie",
        "platform_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
      )
      .code(204)
      .send();
  });

  // Create another operator (gated: requires a platform session).
  app.post("/v1/platform/operators", async (request, reply) => {
    const sessionId = cookieValue(request, "platform_session");
    const session = sessionId === null ? null : platformAuth.getSession(sessionId);
    const body = request.body as { email: string; password: string; displayName: string };
    try {
      const operator = await platformAuth.createOperator({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        actor: { type: "platform", ...(session !== null ? { id: session.operatorId } : {}) },
      });
      return await reply.code(201).send({ id: operator.id, email: operator.email });
    } catch (error) {
      if (error instanceof PlatformOperatorEmailTakenError) {
        return reply.code(409).send({ error: "email-taken" });
      }
      throw error;
    }
  });
}
