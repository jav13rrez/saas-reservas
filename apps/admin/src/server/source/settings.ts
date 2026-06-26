/**
 * Tenant settings data source (feature 003): demo store or persistent API,
 * chosen by ADMIN_DATA_MODE. The API projection and the demo store share the
 * same shape (AdminSettings), so this module is a thin pass-through that maps
 * the API's 400 error codes to Spanish messages.
 */

import { dataMode } from "../config";
import {
  getSettings as demoGetSettings,
  updateSettings as demoUpdateSettings,
  type AdminSettings,
  type UpdateSettingsInput,
  type StoreResult,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

/** Maps the admin-settings API error codes (contract) to Spanish messages. */
const ERROR_MESSAGES: Record<string, string> = {
  "invalid-display-name": "El nombre del negocio es obligatorio.",
  "invalid-locale": "El idioma es obligatorio.",
  "invalid-timezone": "La zona horaria no es válida.",
  "invalid-currency": "La moneda no es válida.",
  "invalid-color": "El color de marca no es un color hex válido.",
  "policy-out-of-range": "Las políticas de reserva están fuera de rango.",
};

export async function getSettings(): Promise<AdminSettings> {
  if (dataMode() === "demo") {
    return demoGetSettings();
  }
  const result = await apiGet<AdminSettings>("/v1/admin/settings");
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? "No se pudo cargar la configuración.");
  }
  return result.data;
}

export async function updateSettings(
  input: UpdateSettingsInput,
): Promise<StoreResult<AdminSettings>> {
  if (dataMode() === "demo") {
    return demoUpdateSettings(input);
  }
  const result = await apiSend<AdminSettings>("PATCH", "/v1/admin/settings", input);
  if (!result.ok || result.data === undefined) {
    const message =
      (result.error !== undefined ? ERROR_MESSAGES[result.error] : undefined) ??
      result.error ??
      "No se pudo guardar la configuración.";
    return { ok: false, error: message };
  }
  return { ok: true, value: result.data };
}
