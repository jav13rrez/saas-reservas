import { NextResponse } from "next/server";
import { createBooking, listBookings } from "@/server/source/bookings";

/**
 * GET  /api/bookings  -> list bookings (newest start first)
 * POST /api/bookings  -> create a booking for an existing service
 *
 * Data source (demo store or persistent API) is selected by ADMIN_DATA_MODE
 * (ADR-0018). Admin bookings are no-charge "book on behalf".
 */

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ items: await listBookings() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar reservas.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
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
    providerId: string;
    customerId: string;
    startAt: string;
  }>;

  const result = await createBooking({
    serviceId: typeof input.serviceId === "string" ? input.serviceId : "",
    providerId: typeof input.providerId === "string" ? input.providerId : "",
    customerId: typeof input.customerId === "string" ? input.customerId : "",
    startAt: typeof input.startAt === "string" ? input.startAt : "",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
