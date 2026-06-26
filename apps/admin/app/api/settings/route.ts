import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/server/source/settings";
import type { UpdateSettingsInput } from "@/server/demo-store";

/**
 * GET   /api/settings  -> read the tenant settings projection
 * PATCH /api/settings  -> partial, all-or-nothing settings update
 *
 * Data source (demo store or persistent API) is selected by ADMIN_DATA_MODE
 * (ADR-0018).
 */

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await getSettings());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar la configuración.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }
  const result = await updateSettings(body as UpdateSettingsInput);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 200 });
}
