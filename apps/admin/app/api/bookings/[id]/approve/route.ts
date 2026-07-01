import { NextResponse } from "next/server";
import { approveBooking } from "@/server/source/bookings";

/**
 * POST /api/bookings/:id/approve  -> pending -> approved (feature 004, US1)
 */

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const result = await approveBooking(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result.value);
}
