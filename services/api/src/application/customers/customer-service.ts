/**
 * Customer registry application service (ADR-0018 Phase 2).
 *
 * Makes customers first-class for the admin console over the existing
 * `customers` table, instead of the per-booking `randomUUID()` ids checkout
 * mints today. Reads return active and anonymized customers alike so the admin
 * can render the full registry; creation is audited (constitution principle V).
 *
 * The console works with a single display `name`; the domain Customer stores
 * `firstName`/`lastName`, so this service owns the split/join.
 */

import { randomUUID } from "node:crypto";
import {
  auditRecordFromEvent,
  createDomainEvent,
  type Actor,
} from "@saas-reservas/domain/audit/events";
import type { Customer } from "@saas-reservas/domain/bookings/booking";
import type { EventSink } from "../events.js";

export interface CustomerRegistryRepository {
  insertCustomer(customer: Customer): Promise<void>;
  listCustomers(tenantId: string): Promise<Customer[]>;
}

export class DuplicateCustomerEmailError extends Error {
  constructor(email: string) {
    super(`a customer with email ${email} already exists`);
    this.name = "DuplicateCustomerEmailError";
  }
}

export class CustomerService {
  constructor(
    private readonly customers: CustomerRegistryRepository,
    private readonly events: EventSink,
  ) {}

  listCustomers(tenantId: string): Promise<Customer[]> {
    return this.customers.listCustomers(tenantId);
  }

  async createCustomer(input: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    actor: Actor;
  }): Promise<Customer> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.customers.listCustomers(input.tenantId);
    if (existing.some((customer) => customer.email.toLowerCase() === email)) {
      throw new DuplicateCustomerEmailError(email);
    }
    const customer: Customer = {
      id: randomUUID(),
      tenantId: input.tenantId,
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      gdprStatus: "active",
      ...(input.phone !== undefined && input.phone.trim() !== ""
        ? { phone: input.phone.trim() }
        : {}),
    };
    await this.customers.insertCustomer(customer);

    const event = createDomainEvent({
      tenantId: input.tenantId,
      type: "registry.customer-created",
      actor: input.actor,
      payload: { entityId: customer.id },
    });
    await this.events.record(
      event,
      auditRecordFromEvent(event, {
        action: "registry.customer-created",
        entityType: "customer",
        entityId: customer.id,
      }),
    );
    return customer;
  }
}
