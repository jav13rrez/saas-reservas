import { NextResponse } from "next/server";
import { setCustomerActive } from "@/server/demo-store";

/**
 * PATCH /api/customers/:id  -> toggle a customer active/inactive
 * Body: { active: boolean }
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
  const active = (body as { active?: unknown }).active;
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "El campo 'active' debe ser booleano." }, { status: 400 });
  }
  const result = setCustomerActive(id, active);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result.value);
}
