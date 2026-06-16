import { NextResponse } from "next/server";
import { createService, listServices } from "@/server/demo-store";

/**
 * GET  /api/services  -> list services
 * POST /api/services  -> create a service
 */

export function GET(): NextResponse {
  return NextResponse.json({ items: listServices() });
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
    resourceId: string;
    resourceUnits: number;
  }>;

  const result = createService({
    name: typeof input.name === "string" ? input.name : "",
    category: typeof input.category === "string" ? input.category : "",
    durationMinutes: typeof input.durationMinutes === "number" ? input.durationMinutes : NaN,
    bufferAfterMinutes: typeof input.bufferAfterMinutes === "number" ? input.bufferAfterMinutes : 0,
    priceAmount: typeof input.priceAmount === "number" ? input.priceAmount : NaN,
    currency: typeof input.currency === "string" ? input.currency : "EUR",
    resourceId: typeof input.resourceId === "string" ? input.resourceId : "",
    resourceUnits: typeof input.resourceUnits === "number" ? input.resourceUnits : 1,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
