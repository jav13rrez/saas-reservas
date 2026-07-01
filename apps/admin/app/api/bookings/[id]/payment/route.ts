import { NextResponse } from "next/server";
import type {
  ManualPaymentMethod,
  ManualPaymentStatus,
} from "@saas-reservas/domain/payments/manual-payment";
import { getBookingPayment, upsertBookingPayment } from "@/server/source/booking-payment";

/**
 * GET /api/bookings/:id/payment  -> read the manual payment for a booking
 *   (null when none has been recorded yet)
 * PUT /api/bookings/:id/payment  -> upsert the manual payment
 *
 * Data source (demo store or persistent API) is selected by ADMIN_DATA_MODE
 * (ADR-0018). Feature 004, US3.
 */

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  try {
    const payment = await getBookingPayment(id);
    return NextResponse.json(payment ?? null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar el pago.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }
  const input = body as Partial<{
    method: ManualPaymentMethod;
    status: ManualPaymentStatus;
    amount: number;
    deposit: number;
    currency: string;
    transactionRef: string;
    notes: string;
  }>;

  const result = await upsertBookingPayment({
    bookingId: id,
    method: (input.method ?? "") as ManualPaymentMethod,
    status: (input.status ?? "") as ManualPaymentStatus,
    amount: typeof input.amount === "number" ? input.amount : -1,
    deposit: typeof input.deposit === "number" ? input.deposit : 0,
    currency: typeof input.currency === "string" ? input.currency : "EUR",
    ...(typeof input.transactionRef === "string" ? { transactionRef: input.transactionRef } : {}),
    ...(typeof input.notes === "string" ? { notes: input.notes } : {}),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 200 });
}
