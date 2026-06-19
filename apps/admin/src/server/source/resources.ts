/**
 * Resource data source (ADR-0018): demo store or persistent API, chosen by
 * ADMIN_DATA_MODE. Same signatures the route handlers use against the demo
 * store, so handlers only swap their import.
 *
 * Impedance owned here (resource hub, ADR-0016): the console edits a resource's
 * `serviceIds`/`locationIds`/`employeeIds` inline, while the domain stores them
 * in three join tables set through separate PUTs, and `active` maps to `status`.
 * Create fans out to resource create + the three hub PUTs; update applies the
 * profile (PATCH) and whichever hub arrays were provided.
 */

import { dataMode } from "../config";
import {
  createResource as demoCreateResource,
  listResources as demoListResources,
  updateResource as demoUpdateResource,
  type AdminResource,
  type CreateResourceInput,
  type StoreResult,
  type UpdateResourceInput,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

interface ApiResource {
  id: string;
  name: string;
  quantity: number;
  status: "active" | "inactive";
  serviceIds: string[];
  locationIds: string[];
  employeeIds: string[];
}

function toAdmin(resource: ApiResource): AdminResource {
  return {
    id: resource.id,
    name: resource.name,
    quantity: resource.quantity,
    locationIds: resource.locationIds,
    serviceIds: resource.serviceIds,
    employeeIds: resource.employeeIds,
    active: resource.status === "active",
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function fetchResources(): Promise<ApiResource[]> {
  const result = await apiGet<{ items: ApiResource[] }>("/v1/admin/resources");
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? "No se pudieron cargar los recursos.");
  }
  return result.data.items;
}

/** Apply the hub arrays present in a patch to a resource via the hub PUT routes. */
async function applyHub(
  id: string,
  hub: { serviceIds?: unknown; locationIds?: unknown; employeeIds?: unknown },
): Promise<void> {
  if (hub.serviceIds !== undefined) {
    await apiSend("PUT", `/v1/admin/resources/${id}/services`, {
      serviceIds: toStringArray(hub.serviceIds),
    });
  }
  if (hub.locationIds !== undefined) {
    await apiSend("PUT", `/v1/admin/resources/${id}/locations`, {
      locationIds: toStringArray(hub.locationIds),
    });
  }
  if (hub.employeeIds !== undefined) {
    await apiSend("PUT", `/v1/admin/resources/${id}/employees`, {
      providerIds: toStringArray(hub.employeeIds),
    });
  }
}

export async function listResources(): Promise<AdminResource[]> {
  if (dataMode() === "demo") {
    return demoListResources();
  }
  return (await fetchResources()).map(toAdmin);
}

export async function createResource(
  input: CreateResourceInput,
): Promise<StoreResult<AdminResource>> {
  if (dataMode() === "demo") {
    return demoCreateResource(input);
  }
  const created = await apiSend<{ id: string }>("POST", "/v1/admin/resources", {
    name: input.name.trim(),
    quantity: input.quantity,
  });
  if (!created.ok || created.data === undefined) {
    return { ok: false, error: created.error ?? "No se pudo crear el recurso." };
  }
  const id = created.data.id;
  await applyHub(id, {
    serviceIds: input.serviceIds,
    locationIds: input.locationIds,
    employeeIds: input.employeeIds,
  });
  return {
    ok: true,
    value: {
      id,
      name: input.name.trim(),
      quantity: input.quantity,
      serviceIds: toStringArray(input.serviceIds),
      locationIds: toStringArray(input.locationIds),
      employeeIds: toStringArray(input.employeeIds),
      active: true,
    },
  };
}

export async function updateResource(
  id: string,
  patch: UpdateResourceInput,
): Promise<StoreResult<AdminResource>> {
  if (dataMode() === "demo") {
    return demoUpdateResource(id, patch);
  }
  const profile: Record<string, unknown> = {};
  if (patch.name !== undefined) profile.name = patch.name.trim();
  if (patch.quantity !== undefined) profile.quantity = patch.quantity;
  if (patch.active !== undefined) profile.active = patch.active;
  if (Object.keys(profile).length > 0) {
    const result = await apiSend("PATCH", `/v1/admin/resources/${id}`, profile);
    if (!result.ok) {
      return { ok: false, error: result.error ?? "No se pudo actualizar el recurso." };
    }
  }
  await applyHub(id, patch);

  const refreshed = (await fetchResources()).find((resource) => resource.id === id);
  if (refreshed === undefined) {
    return { ok: false, error: "Recurso no encontrado." };
  }
  return { ok: true, value: toAdmin(refreshed) };
}
