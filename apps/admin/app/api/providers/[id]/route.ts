import { NextResponse } from "next/server";
import { updateProvider } from "@/server/source/providers";
import { type UpdateProviderInput } from "@/server/demo-store";

/**
 * PATCH /api/providers/:id  -> update a provider's profile, location/service
 *                              assignments, or active state. Any subset of
 *                              fields may be sent.
 *
 * Resource eligibility is configured from /api/resources (hub model).
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
  const raw = body as Partial<{
    name: string;
    email: string;
    timezone: string;
    locationIds: unknown;
    serviceIds: unknown;
    active: boolean;
  }>;

  const patch: UpdateProviderInput = {};
  if (typeof raw.name === "string") patch.name = raw.name;
  if (typeof raw.email === "string") patch.email = raw.email;
  if (typeof raw.timezone === "string") patch.timezone = raw.timezone;
  if (raw.locationIds !== undefined) patch.locationIds = raw.locationIds;
  if (raw.serviceIds !== undefined) patch.serviceIds = raw.serviceIds;
  if (typeof raw.active === "boolean") patch.active = raw.active;

  const result = await updateProvider(id, patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value);
}
