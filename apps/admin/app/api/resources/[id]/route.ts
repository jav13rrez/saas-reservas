import { NextResponse } from "next/server";
import { updateResource } from "@/server/demo-store";

/**
 * PATCH /api/resources/:id  -> update resource fields (name, quantity, arrays, active)
 */

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
  const input = body as Partial<{
    name: string;
    quantity: number;
    locationIds: unknown;
    serviceIds: unknown;
    employeeIds: unknown;
    active: boolean;
  }>;
  const result = updateResource(id, {
    name: input.name,
    quantity: input.quantity,
    locationIds: input.locationIds,
    serviceIds: input.serviceIds,
    employeeIds: input.employeeIds,
    active: input.active,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result.value);
}
