import { NextResponse } from "next/server";
import { apiGet } from "@/server/api-client";

interface StaffItem {
  id: string;
  email: string;
  role: "admin" | "staff";
  status: "active" | "inactive";
  providerId: string | null;
}

/**
 * GET /api/staff  → lista de cuentas de staff del tenant con su vínculo a proveedor.
 * Solo disponible en modo API (ADMIN_DATA_MODE=api); en modo demo devuelve vacío.
 */
export async function GET(): Promise<NextResponse> {
  const result = await apiGet<{ items: StaffItem[] }>("/v1/admin/staff");
  if (!result.ok || result.data === undefined) {
    return NextResponse.json({ items: [] });
  }
  return NextResponse.json({ items: result.data.items });
}
