/**
 * GDPR anonymization (T049, spec US3 scenario 3): personal data in the
 * customer profile is irreversibly replaced while bookings, payments, and
 * reporting metrics remain intact and non-identifying. The action emits a
 * domain event and audit record (constitution principle V) whose metadata
 * never contains the erased data.
 */

import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import type { Customer } from "@saas-reservas/domain/bookings/booking";
import type { EventSink } from "../events.js";

export interface CustomerRepository {
  insertCustomer(customer: Customer): Promise<void>;
  findCustomerById(tenantId: string, customerId: string): Promise<Customer | null>;
  updateCustomer(customer: Customer): Promise<void>;
}

export class CustomerNotFoundError extends Error {
  constructor(customerId: string) {
    super(`customer ${customerId} not found`);
    this.name = "CustomerNotFoundError";
  }
}

export class GdprAnonymizationService {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly events: EventSink,
  ) {}

  /**
   * Anonymizes the customer profile. Idempotent: a second request returns the
   * already-anonymized record without emitting another event.
   */
  async anonymize(input: {
    tenantId: string;
    customerId: string;
    actor: Actor;
  }): Promise<Customer> {
    const customer = await this.customers.findCustomerById(input.tenantId, input.customerId);
    if (customer === null) {
      throw new CustomerNotFoundError(input.customerId);
    }
    if (customer.gdprStatus === "anonymized") {
      return customer;
    }

    const anonymized: Customer = {
      id: customer.id,
      tenantId: customer.tenantId,
      // Deterministic non-identifying placeholder; .invalid never resolves.
      email: `anonymized-${customer.id.slice(0, 8)}@example.invalid`,
      firstName: "Anonymized",
      lastName: "Customer",
      gdprStatus: "anonymized",
    };
    await this.customers.updateCustomer(anonymized);

    const event = createDomainEvent({
      tenantId: input.tenantId,
      type: "privacy.customer-anonymized",
      actor: input.actor,
      payload: { customerId: customer.id },
    });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action: "privacy.customer-anonymized",
        entityType: "customer",
        entityId: customer.id,
      }),
    );
    return anonymized;
  }
}
