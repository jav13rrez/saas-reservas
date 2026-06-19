/**
 * Drizzle adapter for the BookingRepository and CartRepository ports.
 */

import { and, eq } from "drizzle-orm";
import type { Booking, Customer } from "@saas-reservas/domain/bookings/booking";
import type { CartTransaction, SubPayment } from "@saas-reservas/domain/payments/payment";
import type { TenantDb } from "../db.js";
import { bookings, cartTransactions, customers, subPayments } from "../schema.js";

export class DrizzlePaymentRepository {
  constructor(private readonly db: TenantDb) {}

  // --- BookingRepository ---

  async insertBooking(booking: Booking): Promise<void> {
    await this.db.withTenant(booking.tenantId, (tx) =>
      tx.insert(bookings).values(toBookingRow(booking)),
    );
  }

  async updateBooking(booking: Booking): Promise<void> {
    await this.db.withTenant(booking.tenantId, (tx) =>
      tx.update(bookings).set(toBookingRow(booking)).where(eq(bookings.id, booking.id)),
    );
  }

  async findBookingById(tenantId: string, bookingId: string): Promise<Booking | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1),
    );
    const row = rows[0];
    return row === undefined ? null : fromBookingRow(row);
  }

  async listBookingsForCustomer(tenantId: string, customerId: string): Promise<Booking[]> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(bookings).where(eq(bookings.customerId, customerId)),
    );
    return rows.map(fromBookingRow);
  }

  async listBookingsForProvider(tenantId: string, providerId: string): Promise<Booking[]> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(bookings).where(eq(bookings.providerId, providerId)),
    );
    return rows.map(fromBookingRow);
  }

  // --- CustomerRepository ---

  async insertCustomer(customer: Customer): Promise<void> {
    await this.db.withTenant(customer.tenantId, (tx) =>
      tx.insert(customers).values({ ...customer, phone: customer.phone ?? null }),
    );
  }

  async updateCustomer(customer: Customer): Promise<void> {
    await this.db.withTenant(customer.tenantId, (tx) =>
      tx
        .update(customers)
        .set({
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone ?? null,
          gdprStatus: customer.gdprStatus,
          anonymizedAt: customer.gdprStatus === "anonymized" ? new Date() : null,
        })
        .where(eq(customers.id, customer.id)),
    );
  }

  async findCustomerById(tenantId: string, customerId: string): Promise<Customer | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(customers).where(eq(customers.id, customerId)).limit(1),
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return toCustomer(row);
  }

  /** Admin registry read model: all customers for a tenant. */
  async listCustomers(tenantId: string): Promise<Customer[]> {
    const rows = await this.db.withTenant(tenantId, (tx) => tx.select().from(customers));
    return rows.map(toCustomer);
  }

  // --- CartRepository ---

  async insertCart(cart: CartTransaction): Promise<void> {
    await this.db.withTenant(cart.tenantId, (tx) =>
      tx.insert(cartTransactions).values(toCartRow(cart)),
    );
  }

  async updateCart(cart: CartTransaction): Promise<void> {
    await this.db.withTenant(cart.tenantId, (tx) =>
      tx.update(cartTransactions).set(toCartRow(cart)).where(eq(cartTransactions.id, cart.id)),
    );
  }

  async findCartById(tenantId: string, cartId: string): Promise<CartTransaction | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx.select().from(cartTransactions).where(eq(cartTransactions.id, cartId)).limit(1),
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      ...row,
      ...(row.gatewayTransactionId !== null
        ? { gatewayTransactionId: row.gatewayTransactionId }
        : {}),
      gatewayTransactionId: row.gatewayTransactionId ?? undefined,
    } as CartTransaction;
  }

  async insertSubPayment(subPayment: SubPayment): Promise<void> {
    await this.db.withTenant(subPayment.tenantId, (tx) =>
      tx.insert(subPayments).values(subPayment),
    );
  }

  async updateSubPayment(subPayment: SubPayment): Promise<void> {
    await this.db.withTenant(subPayment.tenantId, (tx) =>
      tx.update(subPayments).set(subPayment).where(eq(subPayments.id, subPayment.id)),
    );
  }

  async listSubPayments(tenantId: string, cartId: string): Promise<SubPayment[]> {
    return this.db.withTenant(tenantId, (tx) =>
      tx.select().from(subPayments).where(eq(subPayments.cartTransactionId, cartId)),
    );
  }

  async findSubPaymentByBookingId(tenantId: string, bookingId: string): Promise<SubPayment | null> {
    const rows = await this.db.withTenant(tenantId, (tx) =>
      tx
        .select()
        .from(subPayments)
        .where(and(eq(subPayments.bookingId, bookingId)))
        .limit(1),
    );
    return rows[0] ?? null;
  }
}

function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    ...(row.phone !== null ? { phone: row.phone } : {}),
    gdprStatus: row.gdprStatus,
  };
}

function fromBookingRow(row: typeof bookings.$inferSelect): Booking {
  return {
    ...row,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
  };
}

function toBookingRow(booking: Booking): typeof bookings.$inferInsert {
  return {
    ...booking,
    startAt: new Date(booking.startAt),
    endAt: new Date(booking.endAt),
  };
}

function toCartRow(cart: CartTransaction): typeof cartTransactions.$inferInsert {
  return {
    ...cart,
    gatewayTransactionId: cart.gatewayTransactionId ?? null,
  };
}
