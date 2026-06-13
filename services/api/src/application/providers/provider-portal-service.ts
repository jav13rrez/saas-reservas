/**
 * Staff/provider portal service (T047): permission-checked self-service over a
 * provider's own calendar and bookings. Permissions are tenant-scoped flags on
 * the provider record; staff auth (who is calling) is resolved upstream.
 */

import type { Actor } from "@saas-reservas/domain/audit/events";
import type { Booking } from "@saas-reservas/domain/bookings/booking";
import type {
  Provider,
  ProviderScheduleEntry,
  StaffPermission,
} from "@saas-reservas/domain/providers/provider";
import type { CatalogRepository, CatalogService } from "../catalog/catalog-service.js";
import type { BookingRepository } from "../bookings/booking-service.js";

export class PermissionDeniedError extends Error {
  constructor(
    readonly providerId: string,
    readonly permission: StaffPermission,
  ) {
    super(`provider ${providerId} lacks permission ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export class ProviderNotFoundError extends Error {
  constructor(providerId: string) {
    super(`provider ${providerId} not found`);
    this.name = "ProviderNotFoundError";
  }
}

export class ProviderPortalService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly catalogService: CatalogService,
    private readonly bookings: BookingRepository,
  ) {}

  /** Provider edits their own weekly schedule, days off, and special days. */
  async updateOwnSchedule(input: {
    tenantId: string;
    providerId: string;
    entries: ProviderScheduleEntry[];
    actor: Actor;
  }): Promise<void> {
    await this.requirePermission(input.tenantId, input.providerId, "manage-own-schedule");
    await this.catalogService.setProviderSchedule(input);
  }

  /**
   * Provider lists the bookings they serve. Without the view-customer-contact
   * permission, customerId is replaced by the literal "hidden".
   */
  async listOwnBookings(input: { tenantId: string; providerId: string }): Promise<Booking[]> {
    const provider = await this.requirePermission(
      input.tenantId,
      input.providerId,
      "manage-own-bookings",
    );
    const bookings = await this.bookings.listBookingsForProvider(input.tenantId, input.providerId);
    const mayViewContact = provider.permissions.includes("view-customer-contact");
    return bookings.map((booking) =>
      mayViewContact ? booking : { ...booking, customerId: "hidden" },
    );
  }

  private async requirePermission(
    tenantId: string,
    providerId: string,
    permission: StaffPermission,
  ): Promise<Provider> {
    const provider = await this.catalog.findProviderById(tenantId, providerId);
    if (provider?.status !== "active") {
      throw new ProviderNotFoundError(providerId);
    }
    if (!provider.permissions.includes(permission)) {
      throw new PermissionDeniedError(providerId, permission);
    }
    return provider;
  }
}
