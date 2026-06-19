/**
 * In-memory adapter for the booking and cart repository ports (v1 stand-in for
 * the Drizzle/RLS adapter, mirroring tenant-scoped SQL filters).
 */

import type { Booking, Customer } from "@saas-reservas/domain/bookings/booking";
import type { CartTransaction, SubPayment } from "@saas-reservas/domain/payments/payment";
import type { BookingRepository } from "../../application/bookings/booking-service.js";
import type { CartRepository } from "../../application/payments/cart-reconciliation-service.js";
import type { CustomerRepository } from "../../application/privacy/gdpr-anonymization-service.js";

export class InMemoryPaymentStore implements BookingRepository, CartRepository, CustomerRepository {
  private readonly bookings = new Map<string, Booking>();
  private readonly carts = new Map<string, CartTransaction>();
  private readonly subPayments = new Map<string, SubPayment>();
  private readonly customers = new Map<string, Customer>();

  insertCustomer(customer: Customer): Promise<void> {
    this.customers.set(customer.id, customer);
    return Promise.resolve();
  }

  updateCustomer(customer: Customer): Promise<void> {
    this.customers.set(customer.id, customer);
    return Promise.resolve();
  }

  findCustomerById(tenantId: string, customerId: string): Promise<Customer | null> {
    const customer = this.customers.get(customerId);
    return Promise.resolve(customer?.tenantId === tenantId ? customer : null);
  }

  /** Admin registry read model: all customers for a tenant. */
  listCustomers(tenantId: string): Promise<Customer[]> {
    return Promise.resolve(
      [...this.customers.values()].filter((customer) => customer.tenantId === tenantId),
    );
  }

  /** Customer-portal read model: bookings owned by one customer. */
  listBookingsForCustomer(tenantId: string, customerId: string): Promise<Booking[]> {
    return Promise.resolve(
      [...this.bookings.values()].filter(
        (booking) => booking.tenantId === tenantId && booking.customerId === customerId,
      ),
    );
  }

  /** Staff-portal read model: bookings served by one provider. */
  listBookingsForProvider(tenantId: string, providerId: string): Promise<Booking[]> {
    return Promise.resolve(
      [...this.bookings.values()].filter(
        (booking) => booking.tenantId === tenantId && booking.providerId === providerId,
      ),
    );
  }

  insertBooking(booking: Booking): Promise<void> {
    this.bookings.set(booking.id, booking);
    return Promise.resolve();
  }

  updateBooking(booking: Booking): Promise<void> {
    this.bookings.set(booking.id, booking);
    return Promise.resolve();
  }

  findBookingById(tenantId: string, bookingId: string): Promise<Booking | null> {
    const booking = this.bookings.get(bookingId);
    return Promise.resolve(booking?.tenantId === tenantId ? booking : null);
  }

  insertCart(cart: CartTransaction): Promise<void> {
    this.carts.set(cart.id, cart);
    return Promise.resolve();
  }

  updateCart(cart: CartTransaction): Promise<void> {
    this.carts.set(cart.id, cart);
    return Promise.resolve();
  }

  findCartById(tenantId: string, cartId: string): Promise<CartTransaction | null> {
    const cart = this.carts.get(cartId);
    return Promise.resolve(cart?.tenantId === tenantId ? cart : null);
  }

  insertSubPayment(subPayment: SubPayment): Promise<void> {
    this.subPayments.set(subPayment.id, subPayment);
    return Promise.resolve();
  }

  updateSubPayment(subPayment: SubPayment): Promise<void> {
    this.subPayments.set(subPayment.id, subPayment);
    return Promise.resolve();
  }

  listSubPayments(tenantId: string, cartId: string): Promise<SubPayment[]> {
    return Promise.resolve(
      [...this.subPayments.values()].filter(
        (subPayment) => subPayment.tenantId === tenantId && subPayment.cartTransactionId === cartId,
      ),
    );
  }

  findSubPaymentByBookingId(tenantId: string, bookingId: string): Promise<SubPayment | null> {
    return Promise.resolve(
      [...this.subPayments.values()].find(
        (subPayment) => subPayment.tenantId === tenantId && subPayment.bookingId === bookingId,
      ) ?? null,
    );
  }
}
