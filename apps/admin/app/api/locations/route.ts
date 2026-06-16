import { NextResponse } from "next/server";
import { createLocation, listLocations } from "@/server/demo-store";

/**
 * GET  /api/locations  -> list locations
 * POST /api/locations  -> create a location
 */

export function GET(): NextResponse {
  return NextResponse.json({ items: listLocations() });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }
  const input = body as Partial<{ name: string; timezone: string; address: string }>;
  const result = createLocation({
    name: typeof input.name === "string" ? input.name : "",
    timezone: typeof input.timezone === "string" ? input.timezone : "",
    address: typeof input.address === "string" ? input.address : "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
