import { NextResponse } from "next/server";
import { setLocationActive } from "@/server/source/locations";

/**
 * PATCH /api/locations/:id  -> toggle a location active/inactive
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
  const result = await setLocationActive(id, active);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result.value);
}
