import { NextResponse } from "next/server";
import { getProviderSchedule, setProviderSchedule } from "@/server/source/schedules";
import { type AdminScheduleEntry } from "@/server/demo-store";

/**
 * GET /api/providers/:id/schedule  -> the provider's schedule entries
 * PUT /api/providers/:id/schedule  -> replace the schedule
 * Body: { entries: AdminScheduleEntry[] }
 *
 * Data source (demo store or persistent API) is selected by ADMIN_DATA_MODE
 * (ADR-0018). Entries: weekly windows, special-day overrides, and days off.
 */

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  try {
    return NextResponse.json({ entries: await getProviderSchedule(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar la agenda.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PUT(
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
  const entries = (body as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) {
    return NextResponse.json({ error: "El campo 'entries' debe ser una lista." }, { status: 400 });
  }
  const result = await setProviderSchedule(id, entries as AdminScheduleEntry[]);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ entries: result.value });
}
