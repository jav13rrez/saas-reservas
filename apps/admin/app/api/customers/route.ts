import { NextResponse } from "next/server";
import { createCustomer, listCustomers } from "@/server/source/customers";

/**
 * GET  /api/customers  -> list customers (alphabetical)
 * POST /api/customers  -> create a customer
 *
 * Data source (demo store or persistent API) is selected by ADMIN_DATA_MODE
 * (ADR-0018).
 */

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ items: await listCustomers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar clientes.";
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
  const input = body as Partial<{ name: string; email: string; phone: string }>;
  const result = await createCustomer({
    name: typeof input.name === "string" ? input.name : "",
    email: typeof input.email === "string" ? input.email : "",
    phone: typeof input.phone === "string" ? input.phone : "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
