import { NextResponse } from "next/server";
import { getPayment, upsertPayment } from "@/server/source/booking-payment";
import type { UpsertPaymentInput } from "@/server/demo-store";

/**
 * GET /api/bookings/:id/payment -> the booking's manual payment record, or null
 * PUT /api/bookings/:id/payment -> upsert the manual payment record
 */

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  try {
    return NextResponse.json(await getPayment(id));
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
  const result = await upsertPayment(id, body as UpsertPaymentInput);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value);
}
