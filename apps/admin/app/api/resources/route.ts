import { NextResponse } from "next/server";
import { createResource, listResources } from "@/server/demo-store";

/**
 * GET  /api/resources  -> list resources
 * POST /api/resources  -> create a resource (hub model: declares locations, services, providers)
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
  const input = body as Partial<{
    name: string;
    quantity: number;
    locationIds: unknown;
    serviceIds: unknown;
    employeeIds: unknown;
  }>;
  const result = createResource({
    name: typeof input.name === "string" ? input.name : "",
    quantity: typeof input.quantity === "number" ? input.quantity : NaN,
    locationIds: input.locationIds ?? [],
    serviceIds: input.serviceIds ?? [],
    employeeIds: input.employeeIds ?? [],
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
