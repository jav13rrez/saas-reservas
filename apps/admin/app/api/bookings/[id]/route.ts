import { NextResponse } from "next/server";
import { cancelBooking } from "@/server/demo-store";

/**
 * PATCH /api/bookings/:id  -> cancel a booking
 * Body: { status: "cancelled" }
 */

export async function PATCH(
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
  const status = (body as { status?: unknown }).status;
  if (status !== "cancelled") {
    return NextResponse.json(
      { error: "Solo se admite la transición a 'cancelled'." },
      { status: 400 },
    );
  }
  const result = cancelBooking(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value);
}
