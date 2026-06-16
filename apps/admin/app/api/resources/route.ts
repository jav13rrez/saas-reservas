import { NextResponse } from "next/server";
import { createResource, listResources } from "@/server/demo-store";

/**
 * GET  /api/resources  -> list resources
 * POST /api/resources  -> create a resource (pool with a quantity at a location)
 */

export function GET(): NextResponse {
  return NextResponse.json({ items: listResources() });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }
  const input = body as Partial<{ name: string; quantity: number; locationId: string }>;
  const result = createResource({
    name: typeof input.name === "string" ? input.name : "",
    quantity: typeof input.quantity === "number" ? input.quantity : NaN,
    locationId: typeof input.locationId === "string" ? input.locationId : "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
