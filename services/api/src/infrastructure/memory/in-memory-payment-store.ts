/**
 * In-memory adapter for the booking and cart repository ports (v1 stand-in for
 * the Drizzle/RLS adapter, mirroring tenant-scoped SQL filters).
 */

import type { Booking } from "@saas-reservas/domain/bookings/booking";
import type { CartTransaction, SubPayment } from "@saas-reservas/domain/payments/payment";
import type { BookingRepository } from "../../application/bookings/booking-service.js";
import type { CartRepository } from "../../application/payments/cart-reconciliation-service.js";

export class InMemoryPaymentStore implements BookingRepository, CartRepository {
  private readonly bookings = new Map<string, Booking>();
  private readonly carts = new Map<string, CartTransaction>();
  private readonly subPayments = new Map<string, SubPayment>();

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
