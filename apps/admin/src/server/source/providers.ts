/**
 * Provider data source (ADR-0018): demo store or persistent API, chosen by
 * ADMIN_DATA_MODE. Same signatures the route handlers use against the demo
 * store, so handlers only swap their import.
 *
 * Impedance owned here: the console's `name` maps to the domain `displayName`
 * and `active` to `status`; a provider's `serviceIds`/`locationIds` live in join
 * tables set through separate calls. Create fans out to provider create + per
 * service assignment + a locations PUT; update diffs the service assignments
 * (assign added, unassign removed) and re-sets locations/profile/status.
 */

import { dataMode } from "../config";
import {
  createProvider as demoCreateProvider,
  listProviders as demoListProviders,
  updateProvider as demoUpdateProvider,
  type AdminProvider,
  type CreateProviderInput,
  type StoreResult,
  type UpdateProviderInput,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

interface ApiProvider {
  id: string;
  email: string;
  displayName: string;
  timezone?: string;
  status: "active" | "inactive";
  serviceIds: string[];
  locationIds: string[];
}

function toAdmin(provider: ApiProvider): AdminProvider {
  return {
    id: provider.id,
    name: provider.displayName,
    email: provider.email,
    locationIds: provider.locationIds,
    serviceIds: provider.serviceIds,
    active: provider.status === "active",
    ...(provider.timezone !== undefined && provider.timezone !== ""
      ? { timezone: provider.timezone }
      : {}),
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function fetchProviders(): Promise<ApiProvider[]> {
  const result = await apiGet<{ items: ApiProvider[] }>("/v1/admin/providers");
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? "No se pudieron cargar los proveedores.");
  }
  return result.data.items;
}

export async function listProviders(): Promise<AdminProvider[]> {
  if (dataMode() === "demo") {
    return demoListProviders();
  }
  return (await fetchProviders()).map(toAdmin);
}

export async function createProvider(
  input: CreateProviderInput,
): Promise<StoreResult<AdminProvider>> {
  if (dataMode() === "demo") {
    return demoCreateProvider(input);
  }
  const created = await apiSend<{ id: string }>("POST", "/v1/admin/providers", {
    email: input.email.trim().toLowerCase(),
    displayName: input.name.trim(),
    timezone: input.timezone.trim(),
  });
  if (!created.ok || created.data === undefined) {
    return { ok: false, error: created.error ?? "No se pudo crear el proveedor." };
  }
  const providerId = created.data.id;
  const serviceIds = toStringArray(input.serviceIds);
  const locationIds = toStringArray(input.locationIds);
  for (const serviceId of serviceIds) {
    await apiSend("POST", `/v1/admin/services/${serviceId}/providers`, { providerId });
  }
  await apiSend("PUT", `/v1/admin/providers/${providerId}/locations`, { locationIds });

  return {
    ok: true,
    value: {
      id: providerId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      locationIds,
      serviceIds,
      active: true,
      ...(input.timezone.trim() !== "" ? { timezone: input.timezone.trim() } : {}),
    },
  };
}

export async function updateProvider(
  id: string,
  patch: UpdateProviderInput,
): Promise<StoreResult<AdminProvider>> {
  if (dataMode() === "demo") {
    return demoUpdateProvider(id, patch);
  }
  const current = (await fetchProviders()).find((provider) => provider.id === id);
  if (current === undefined) {
    return { ok: false, error: "Proveedor no encontrado." };
  }

  // Profile + status.
  const profile: Record<string, unknown> = {};
  if (patch.name !== undefined) profile.displayName = patch.name.trim();
  if (patch.email !== undefined) profile.email = patch.email.trim().toLowerCase();
  if (patch.timezone !== undefined) profile.timezone = patch.timezone.trim();
  if (patch.active !== undefined) profile.active = patch.active;
  if (Object.keys(profile).length > 0) {
    const result = await apiSend("PATCH", `/v1/admin/providers/${id}`, profile);
    if (!result.ok) {
      return { ok: false, error: result.error ?? "No se pudo actualizar el proveedor." };
    }
  }

  // Locations (replace).
  if (patch.locationIds !== undefined) {
    await apiSend("PUT", `/v1/admin/providers/${id}/locations`, {
      locationIds: toStringArray(patch.locationIds),
    });
  }

  // Service assignments (diff against current).
  if (patch.serviceIds !== undefined) {
    const next = new Set(toStringArray(patch.serviceIds));
    const prev = new Set(current.serviceIds);
    for (const serviceId of next) {
      if (!prev.has(serviceId)) {
        await apiSend("POST", `/v1/admin/services/${serviceId}/providers`, { providerId: id });
      }
    }
    for (const serviceId of prev) {
      if (!next.has(serviceId)) {
        await apiSend("DELETE", `/v1/admin/services/${serviceId}/providers/${id}`);
      }
    }
  }

  const refreshed = (await fetchProviders()).find((provider) => provider.id === id);
  if (refreshed === undefined) {
    return { ok: false, error: "Proveedor no encontrado tras la actualización." };
  }
  return { ok: true, value: toAdmin(refreshed) };
}
