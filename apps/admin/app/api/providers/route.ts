import { NextResponse } from "next/server";
import { createProvider, listProviders } from "@/server/source/providers";

/**
 * GET  /api/providers  -> list providers (with their location/service assignments)
 * POST /api/providers  -> create a provider
 *
 * Resource eligibility is configured from /api/resources (hub model).
 * Data source (demo store or persistent API) is selected by ADMIN_DATA_MODE
 * (ADR-0018).
 */

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ items: await listProviders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar proveedores.";
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
    email: string;
    timezone: string;
    locationIds: unknown;
    serviceIds: unknown;
  }>;
  const result = await createProvider({
    name: typeof input.name === "string" ? input.name : "",
    email: typeof input.email === "string" ? input.email : "",
    timezone: typeof input.timezone === "string" ? input.timezone : "",
    locationIds: input.locationIds,
    serviceIds: input.serviceIds,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
