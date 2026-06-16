import { NextResponse } from "next/server";
import { createBooking, listBookings } from "@/server/demo-store";

/**
 * GET  /api/bookings  -> list bookings (newest start first)
 * POST /api/bookings  -> create a booking for an existing service
 */

export function GET(): NextResponse {
  return NextResponse.json({ items: listBookings() });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }
  const input = body as Partial<{
    serviceId: string;
    customerName: string;
    customerEmail: string;
    startAt: string;
  }>;

  const result = createBooking({
    serviceId: typeof input.serviceId === "string" ? input.serviceId : "",
    customerName: typeof input.customerName === "string" ? input.customerName : "",
    customerEmail: typeof input.customerEmail === "string" ? input.customerEmail : "",
    startAt: typeof input.startAt === "string" ? input.startAt : "",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
