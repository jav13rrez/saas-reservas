import { NextResponse } from "next/server";
import { createCustomer, listCustomers } from "@/server/demo-store";

/**
 * GET  /api/customers  -> list customers (alphabetical)
 * POST /api/customers  -> create a customer
 */

export function GET(): NextResponse {
  return NextResponse.json({ items: listCustomers() });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }
  const input = body as Partial<{ name: string; email: string; phone: string }>;
  const result = createCustomer({
    name: typeof input.name === "string" ? input.name : "",
    email: typeof input.email === "string" ? input.email : "",
    phone: typeof input.phone === "string" ? input.phone : "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.value, { status: 201 });
}
