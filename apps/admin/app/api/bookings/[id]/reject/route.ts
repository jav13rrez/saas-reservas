import { NextResponse } from "next/server";
import { rejectBooking } from "@/server/source/bookings";

/**
 * POST /api/bookings/:id/reject  -> pending -> rejected (feature 004, US1)
 * Frees the held slot occupancy.
 */

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const result = await rejectBooking(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result.value);
}
