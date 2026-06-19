import { NextResponse } from "next/server";
import { createLocation, listLocations } from "@/server/source/locations";

/**
 * GET  /api/locations  -> list locations
 * POST /api/locations  -> create a location
 *
 * Data source (demo store or persistent API) is selected by ADMIN_DATA_MODE
 * (ADR-0018); this handler is agnostic to it.
 */

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ items: await listLocations() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar ubicaciones.";
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
  const input = body as Partial<{ name: string; timezone: string; address: string }>;
  const result = await createLocation({
    name: typeof input.name === "string" ? input.name : "",
    timezone: typeof input.timezone === "string" ? input.timezone : "",
    address: typeof input.address === "string" ? input.address : "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
