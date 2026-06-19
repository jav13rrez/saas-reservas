import { NextResponse } from "next/server";
import { createService, listServices } from "@/server/source/services";

/**
 * GET  /api/services  -> list services
 * POST /api/services  -> create a service
 *
 * Resource association is configured from /api/resources (hub model): the
 * resource declares which services consume its capacity, not the service.
 * Data source (demo store or persistent API) is selected by ADMIN_DATA_MODE
 * (ADR-0018).
 */

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ items: await listServices() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar servicios.";
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
    name: string;
    category: string;
    durationMinutes: number;
    bufferAfterMinutes: number;
    priceAmount: number;
    currency: string;
  }>;

  const result = await createService({
    name: typeof input.name === "string" ? input.name : "",
    category: typeof input.category === "string" ? input.category : "",
    durationMinutes: typeof input.durationMinutes === "number" ? input.durationMinutes : NaN,
    bufferAfterMinutes: typeof input.bufferAfterMinutes === "number" ? input.bufferAfterMinutes : 0,
    priceAmount: typeof input.priceAmount === "number" ? input.priceAmount : NaN,
    currency: typeof input.currency === "string" ? input.currency : "EUR",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
