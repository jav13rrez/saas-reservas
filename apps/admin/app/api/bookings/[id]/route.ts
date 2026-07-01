import { NextResponse } from "next/server";
import {
  approveBooking,
  cancelBooking,
  completeBooking,
  noShowBooking,
  rejectBooking,
} from "@/server/source/bookings";
import type { AdminBooking, StoreResult } from "@/server/demo-store";

/**
 * PATCH /api/bookings/:id  -> apply a lifecycle transition
 * Body: { status: "approved" | "rejected" | "canceled" | "completed" | "no_show" }
 */

const ACTIONS: Record<string, (id: string) => Promise<StoreResult<AdminBooking>>> = {
  approved: approveBooking,
  rejected: rejectBooking,
  canceled: cancelBooking,
  completed: completeBooking,
  no_show: noShowBooking,
};

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
  const action = typeof status === "string" ? ACTIONS[status] : undefined;
  if (action === undefined) {
    return NextResponse.json(
      { error: "Estado no admitido: approved, rejected, canceled, completed o no_show." },
      { status: 400 },
    );
  }
  const result = await action(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value);
}
