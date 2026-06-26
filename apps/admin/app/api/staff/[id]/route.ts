import { NextResponse } from "next/server";
import { apiSend } from "@/server/api-client";

/**
 * PATCH /api/staff/:id  → vincula o desvincula un proveedor de la cuenta de staff.
 * Body: { providerId: string | null }
 * 200: { id, providerId }
 * 409: proveedor ya vinculado a otro staff
 * 404: staff o proveedor no encontrado
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const { id } = await params;
  const result = await apiSend<{ id: string; providerId: string | null }>(
    "PATCH",
    `/v1/admin/staff/${id}`,
    { providerId: (body as { providerId?: unknown }).providerId ?? null },
  );

  if (!result.ok) {
    const status = result.status === 404 ? 404 : result.status === 409 ? 409 : 502;
    return NextResponse.json(
      { error: result.error ?? "Error al actualizar el vínculo." },
      { status },
    );
  }
  return NextResponse.json(result.data);
}
