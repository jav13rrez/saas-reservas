/**
 * Manual payment data source (feature 004, US3): demo store or persistent API,
 * chosen by ADMIN_DATA_MODE. One record per booking, off-gateway (cash, card
 * terminal, bank transfer) — mirrors the shape the API returns.
 */

import { dataMode } from "../config";
import {
  getPayment as demoGetPayment,
  upsertPayment as demoUpsertPayment,
  type ManualPayment,
  type StoreResult,
  type UpsertPaymentInput,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

const PAYMENT_ERRORS: Record<string, string> = {
  "invalid-method": "El método de pago no es válido.",
  "invalid-status": "El estado de pago no es válido.",
  "invalid-amount": "El importe debe ser un entero no negativo.",
  "invalid-deposit": "El depósito debe ser un entero entre 0 y el importe.",
};

export async function getPayment(bookingId: string): Promise<ManualPayment | null> {
  if (dataMode() === "demo") {
    return demoGetPayment(bookingId);
  }
  const result = await apiGet<ManualPayment | null>(`/v1/admin/bookings/${bookingId}/payment`);
  if (!result.ok) {
    throw new Error(result.error ?? "No se pudo cargar el pago de la reserva.");
  }
  return result.data ?? null;
}

export async function upsertPayment(
  bookingId: string,
  input: UpsertPaymentInput,
): Promise<StoreResult<ManualPayment>> {
  if (dataMode() === "demo") {
    return demoUpsertPayment(bookingId, input);
  }
  const result = await apiSend<ManualPayment>(
    "PUT",
    `/v1/admin/bookings/${bookingId}/payment`,
    input,
  );
  if (!result.ok || result.data === undefined) {
    const message =
      (result.error !== undefined ? PAYMENT_ERRORS[result.error] : undefined) ??
      result.error ??
      "No se pudo guardar el pago.";
    return { ok: false, error: message };
  }
  return { ok: true, value: result.data };
}
