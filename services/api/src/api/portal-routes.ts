/**
 * Customer and staff portal API surfaces (T050).
 *
 * Customer routes authenticate with the opaque `customer_session` cookie
 * minted by the passwordless redeem endpoint (ADR-0005). Staff routes are
 * scoped by the `x-provider-id` header as a DEV-ONLY stand-in until staff
 * password auth lands with the identity tasks; permission checks are already
 * real (T047). Access-link issuance is also dev-only here: production sends
 * the link by email instead of returning it.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ProviderScheduleEntry } from "@saas-reservas/domain/providers/provider";
import type { TenantPolicies } from "@saas-reservas/domain/tenancy/tenant";
import type { BookingChangeService } from "../application/bookings/booking-change-service.js";
import { ChangeRejectedError } from "../application/bookings/booking-change-service.js";
import type { BookingRepository } from "../application/bookings/booking-service.js";
import type {
  CustomerPasswordlessService,
  CustomerSession,
} from "../application/identity/customer-passwordless-service.js";
import type { GdprAnonymizationService } from "../application/privacy/gdpr-anonymization-service.js";
import {
  PermissionDeniedError,
  ProviderNotFoundError,
  type ProviderPortalService,
} from "../application/providers/provider-portal-service.js";

export interface PortalDeps {
  passwordless: CustomerPasswordlessService;
  changes: BookingChangeService;
  gdpr: GdprAnonymizationService;
  providerPortal: ProviderPortalService;
  bookings: BookingRepository;
  tenantSettings(tenantId: string): Promise<{ policies: TenantPolicies; timezone: string }>;
}

function cookieValue(request: FastifyRequest, name: string): string | null {
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

function changeErrorStatus(error: ChangeRejectedError): number {
  switch (error.reason) {
    case "booking-not-found":
      return 404;
    case "slot-not-available":
      return 409;
    case "too-late":
    case "invalid-status":
    case "already-started":
      return 422; // policy rejection
  }
}

export function registerPortalRoutes(app: FastifyInstance, deps: PortalDeps): void {
  function customerSession(request: FastifyRequest): CustomerSession | null {
    const tenant = request.tenant;
    const sessionId = cookieValue(request, "customer_session");
    if (tenant === undefined || sessionId === null) {
      return null;
    }
    return deps.passwordless.getSession(sessionId, tenant.tenantId);
  }

  // DEV-ONLY: production emails the link instead of returning the token.
  app.post("/v1/portal/customer/access-links", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const { customerId } = request.body as { customerId: string };
    const token = await deps.passwordless.issueAccessToken({
      tenantId: tenant.tenantId,
      customerId,
    });
    return reply.code(201).send({ token });
  });

  app.post("/v1/portal/customer/sessions", async (request, reply) => {
    const tenant = request.tenant;
    if (tenant === undefined) {
      return reply.code(404).send({ error: "unknown-host" });
    }
    const { token } = request.body as { token: string };
    const result = await deps.passwordless.redeem(token);
    if (!result.ok) {
      return reply.code(401).send({ error: result.reason });
    }
    if (result.session.tenantId !== tenant.tenantId) {
      return reply.code(403).send({ error: "tenant-mismatch" });
    }
    const cookie = result.cookie;
    return reply
      .header(
        "set-cookie",
        `${cookie.name}=${cookie.value}; Max-Age=${String(cookie.maxAgeSeconds)}; Path=${cookie.path}; HttpOnly; Secure; SameSite=${cookie.sameSite}`,
      )
      .code(201)
      .send({ customerId: result.session.customerId, expiresAt: result.session.expiresAt });
  });

  app.get("/v1/portal/customer/bookings", async (request, reply) => {
    const session = customerSession(request);
    if (session === null) {
      return reply.code(401).send({ error: "unauthenticated" });
    }
    const bookings = await deps.bookings.listBookingsForCustomer(
      session.tenantId,
      session.customerId,
    );
    return reply.send({ bookings });
  });

  app.post("/v1/portal/customer/bookings/:bookingId/cancel", async (request, reply) => {
    const session = customerSession(request);
    if (session === null) {
      return reply.code(401).send({ error: "unauthenticated" });
    }
    const { bookingId } = request.params as { bookingId: string };
    const booking = await deps.bookings.findBookingById(session.tenantId, bookingId);
    if (booking?.customerId !== session.customerId) {
      return reply.code(404).send({ error: "booking-not-found" });
    }
    const { policies } = await deps.tenantSettings(session.tenantId);
    try {
      const result = await deps.changes.cancel({
        tenantId: session.tenantId,
        bookingId,
        policies,
        actor: { type: "customer", id: session.customerId },
      });
      return await reply.send({ status: result.booking.status, refund: result.refund });
    } catch (error) {
      if (error instanceof ChangeRejectedError) {
        return reply.code(changeErrorStatus(error)).send({ error: error.reason });
      }
      throw error;
    }
  });

  app.post("/v1/portal/customer/bookings/:bookingId/reschedule", async (request, reply) => {
    const session = customerSession(request);
    if (session === null) {
      return reply.code(401).send({ error: "unauthenticated" });
    }
    const { bookingId } = request.params as { bookingId: string };
    const body = request.body as { startAt: string; date: string };
    const booking = await deps.bookings.findBookingById(session.tenantId, bookingId);
    if (booking?.customerId !== session.customerId) {
      return reply.code(404).send({ error: "booking-not-found" });
    }
    const { policies, timezone } = await deps.tenantSettings(session.tenantId);
    try {
      const result = await deps.changes.reschedule({
        tenantId: session.tenantId,
        bookingId,
        newStartAt: body.startAt,
        newDate: body.date,
        policies,
        tenantTimezone: timezone,
        actor: { type: "customer", id: session.customerId },
      });
      return await reply.send({
        oldBookingId: result.oldBooking.id,
        newBookingId: result.newBooking.id,
        startAt: result.newBooking.startAt,
      });
    } catch (error) {
      if (error instanceof ChangeRejectedError) {
        return reply.code(changeErrorStatus(error)).send({ error: error.reason });
      }
      throw error;
    }
  });

  app.post("/v1/portal/customer/gdpr-erasure", async (request, reply) => {
    const session = customerSession(request);
    if (session === null) {
      return reply.code(401).send({ error: "unauthenticated" });
    }
    const customer = await deps.gdpr.anonymize({
      tenantId: session.tenantId,
      customerId: session.customerId,
      actor: { type: "customer", id: session.customerId },
    });
    return reply.send({ gdprStatus: customer.gdprStatus });
  });

  // --- Staff portal (DEV-ONLY identification via x-provider-id header) ---

  function staffProviderId(request: FastifyRequest, reply: FastifyReply): string | null {
    const providerId = request.headers["x-provider-id"];
    if (request.tenant === undefined || typeof providerId !== "string" || providerId === "") {
      void reply.code(401).send({ error: "unauthenticated" });
      return null;
    }
    return providerId;
  }

  app.put("/v1/portal/staff/schedule", async (request, reply) => {
    const providerId = staffProviderId(request, reply);
    if (providerId === null || request.tenant === undefined) {
      return reply;
    }
    const body = request.body as { entries: ProviderScheduleEntry[] };
    try {
      await deps.providerPortal.updateOwnSchedule({
        tenantId: request.tenant.tenantId,
        providerId,
        entries: body.entries,
        actor: { type: "staff", id: providerId },
      });
      return await reply.code(204).send();
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return reply.code(403).send({ error: "permission-denied", permission: error.permission });
      }
      if (error instanceof ProviderNotFoundError) {
        return reply.code(404).send({ error: "provider-not-found" });
      }
      throw error;
    }
  });

  app.get("/v1/portal/staff/bookings", async (request, reply) => {
    const providerId = staffProviderId(request, reply);
    if (providerId === null || request.tenant === undefined) {
      return reply;
    }
    try {
      const bookings = await deps.providerPortal.listOwnBookings({
        tenantId: request.tenant.tenantId,
        providerId,
      });
      return await reply.send({ bookings });
    } catch (error) {
      if (error instanceof PermissionDeniedError) {
        return reply.code(403).send({ error: "permission-denied", permission: error.permission });
      }
      if (error instanceof ProviderNotFoundError) {
        return reply.code(404).send({ error: "provider-not-found" });
      }
      throw error;
    }
  });
}
