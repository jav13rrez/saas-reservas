/**
 * Manual booking payment data source (feature 004, US3): demo store or
 * persistent API, chosen by ADMIN_DATA_MODE. Mirrors `source/settings.ts`:
 * a thin pass-through in `api` mode, direct store calls in `demo` mode.
 *
 * One manual payment per booking; distinct from the gateway/Stripe cart —
 * this is staff-entered money taken outside the online checkout (cash, card
 * terminal, bank transfer).
 */

import type { ManualPayment } from "@saas-reservas/domain/payments/manual-payment";
import { dataMode } from "../config";
import {
  getBookingPayment as demoGetBookingPayment,
  upsertBookingPayment as demoUpsertBookingPayment,
  type StoreResult,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

export async function getBookingPayment(bookingId: string): Promise<ManualPayment | undefined> {
  if (dataMode() === "demo") {
    return demoGetBookingPayment(bookingId);
  }
  const result = await apiGet<ManualPayment | null>(`/v1/admin/bookings/${bookingId}/payment`);
  if (!result.ok) {
    throw new Error(result.error ?? "No se pudo cargar el pago de la reserva.");
  }
  return result.data ?? undefined;
}

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-method": "El método de pago no es válido.",
  "invalid-status": "El estado de pago no es válido.",
  "invalid-amount": "El importe debe ser un número entero no negativo.",
  "invalid-deposit": "El depósito debe ser un entero no negativo y no puede superar el importe.",
};

export async function upsertBookingPayment(
  payment: ManualPayment,
): Promise<StoreResult<ManualPayment>> {
  if (dataMode() === "demo") {
    return demoUpsertBookingPayment(payment);
  }
  const result = await apiSend<ManualPayment>(
    "PUT",
    `/v1/admin/bookings/${payment.bookingId}/payment`,
    {
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      deposit: payment.deposit,
      currency: payment.currency,
      ...(payment.transactionRef !== undefined ? { transactionRef: payment.transactionRef } : {}),
      ...(payment.notes !== undefined ? { notes: payment.notes } : {}),
    },
  );
  if (!result.ok || result.data === undefined) {
    const message =
      (result.error !== undefined ? ERROR_MESSAGES[result.error] : undefined) ??
      result.error ??
      "No se pudo guardar el pago.";
    return { ok: false, error: message };
  }
  return { ok: true, value: result.data };
}
