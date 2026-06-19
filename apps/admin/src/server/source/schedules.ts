/**
 * Provider schedule data source (ADR-0018): demo store or persistent API, chosen
 * by ADMIN_DATA_MODE. The console's schedule entry shape mirrors the domain
 * `ProviderScheduleEntry` 1:1, so mapping is identity; this module only chooses
 * the backend and adapts error handling.
 */

import { dataMode } from "../config";
import {
  getProviderSchedule as demoGetSchedule,
  setProviderSchedule as demoSetSchedule,
  type AdminScheduleEntry,
  type StoreResult,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

export async function getProviderSchedule(providerId: string): Promise<AdminScheduleEntry[]> {
  if (dataMode() === "demo") {
    return demoGetSchedule(providerId);
  }
  const result = await apiGet<{ entries: AdminScheduleEntry[] }>(
    `/v1/admin/providers/${providerId}/schedule`,
  );
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? "No se pudo cargar la agenda del proveedor.");
  }
  return result.data.entries;
}

export async function setProviderSchedule(
  providerId: string,
  entries: AdminScheduleEntry[],
): Promise<StoreResult<AdminScheduleEntry[]>> {
  if (dataMode() === "demo") {
    return demoSetSchedule(providerId, entries);
  }
  // The API validates entries (domain rules) and returns 204 on success.
  const result = await apiSend("PUT", `/v1/admin/providers/${providerId}/schedule`, { entries });
  if (!result.ok) {
    return { ok: false, error: result.error ?? "No se pudo guardar la agenda." };
  }
  return { ok: true, value: entries };
}
