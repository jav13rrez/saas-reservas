/**
 * Location data source (ADR-0018): demo store or persistent API, chosen by
 * ADMIN_DATA_MODE. Exposes the same signatures the route handlers already use
 * against the demo store, so handlers only swap their import.
 *
 * Locations map almost 1:1 between the console DTO (`active: boolean`) and the
 * domain shape (`status: "active" | "inactive"`); this module owns that mapping.
 */

import { dataMode } from "../config";
import {
  createLocation as demoCreateLocation,
  listLocations as demoListLocations,
  setLocationActive as demoSetLocationActive,
  type AdminLocation,
  type CreateLocationInput,
  type StoreResult,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

interface ApiLocation {
  id: string;
  tenantId: string;
  name: string;
  timezone?: string;
  address?: string;
  status: "active" | "inactive";
}

function toAdmin(location: ApiLocation): AdminLocation {
  return {
    id: location.id,
    name: location.name,
    active: location.status === "active",
    ...(location.timezone !== undefined ? { timezone: location.timezone } : {}),
    ...(location.address !== undefined ? { address: location.address } : {}),
  };
}

export async function listLocations(): Promise<AdminLocation[]> {
  if (dataMode() === "demo") {
    return demoListLocations();
  }
  const result = await apiGet<{ items: ApiLocation[] }>("/v1/admin/locations");
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? "No se pudieron cargar las ubicaciones.");
  }
  return result.data.items.map(toAdmin);
}

export async function createLocation(
  input: CreateLocationInput,
): Promise<StoreResult<AdminLocation>> {
  if (dataMode() === "demo") {
    return demoCreateLocation(input);
  }
  const body: Record<string, string> = { name: input.name.trim() };
  if (input.timezone.trim() !== "") {
    body.timezone = input.timezone.trim();
  }
  if (input.address.trim() !== "") {
    body.address = input.address.trim();
  }
  const result = await apiSend<ApiLocation>("POST", "/v1/admin/locations", body);
  if (!result.ok || result.data === undefined) {
    return { ok: false, error: result.error ?? "No se pudo crear la ubicación." };
  }
  return { ok: true, value: toAdmin(result.data) };
}

export async function setLocationActive(
  id: string,
  active: boolean,
): Promise<StoreResult<AdminLocation>> {
  if (dataMode() === "demo") {
    return demoSetLocationActive(id, active);
  }
  const result = await apiSend<ApiLocation>("PATCH", `/v1/admin/locations/${id}`, { active });
  if (!result.ok || result.data === undefined) {
    return { ok: false, error: result.error ?? "No se pudo actualizar la ubicación." };
  }
  return { ok: true, value: toAdmin(result.data) };
}
