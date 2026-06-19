/**
 * Service data source (ADR-0018): demo store or persistent API, chosen by
 * ADMIN_DATA_MODE. Same signatures the route handlers use against the demo
 * store, so handlers only swap their import.
 *
 * Impedance owned here: the console uses a free-text `category` string, while
 * the domain Service references a `categoryId` (Category entity). In API mode
 * this module resolves the category by name (creating it if absent) on write,
 * and maps `categoryId` back to its name on read. The active toggle is not yet
 * supported in API mode (no service-update route); it returns a clear error.
 */

import { dataMode } from "../config";
import {
  createService as demoCreateService,
  listServices as demoListServices,
  setServiceActive as demoSetServiceActive,
  type AdminService,
  type CreateServiceInput,
  type StoreResult,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

interface ApiCategory {
  id: string;
  name: string;
}

interface ApiService {
  id: string;
  name: string;
  categoryId: string;
  durationMinutes: number;
  bufferAfterMinutes: number;
  priceAmount: number;
  currency: string;
  status: "active" | "inactive";
}

function toAdmin(service: ApiService, categoryName: string): AdminService {
  return {
    id: service.id,
    name: service.name,
    category: categoryName,
    durationMinutes: service.durationMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    priceAmount: service.priceAmount,
    currency: service.currency,
    active: service.status === "active",
  };
}

async function listCategories(): Promise<ApiCategory[]> {
  const result = await apiGet<{ items: ApiCategory[] }>("/v1/admin/categories");
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? "No se pudieron cargar las categorías.");
  }
  return result.data.items;
}

/** Resolve a category id by name, creating the category when it does not exist. */
async function resolveCategoryId(name: string): Promise<string> {
  const target = name.trim() === "" ? "General" : name.trim();
  const existing = await listCategories();
  const match = existing.find((category) => category.name.toLowerCase() === target.toLowerCase());
  if (match !== undefined) {
    return match.id;
  }
  const created = await apiSend<ApiCategory>("POST", "/v1/admin/categories", { name: target });
  if (!created.ok || created.data === undefined) {
    throw new Error(created.error ?? "No se pudo crear la categoría.");
  }
  return created.data.id;
}

export async function listServices(): Promise<AdminService[]> {
  if (dataMode() === "demo") {
    return demoListServices();
  }
  const [servicesResult, categories] = await Promise.all([
    apiGet<{ items: ApiService[] }>("/v1/admin/services"),
    listCategories(),
  ]);
  if (!servicesResult.ok || servicesResult.data === undefined) {
    throw new Error(servicesResult.error ?? "No se pudieron cargar los servicios.");
  }
  const nameById = new Map(categories.map((category) => [category.id, category.name]));
  return servicesResult.data.items.map((service) =>
    toAdmin(service, nameById.get(service.categoryId) ?? "General"),
  );
}

export async function createService(input: CreateServiceInput): Promise<StoreResult<AdminService>> {
  if (dataMode() === "demo") {
    return demoCreateService(input);
  }
  try {
    const categoryName = input.category.trim() === "" ? "General" : input.category.trim();
    const categoryId = await resolveCategoryId(categoryName);
    const result = await apiSend<ApiService>("POST", "/v1/admin/services", {
      categoryId,
      name: input.name.trim(),
      durationMinutes: Math.round(input.durationMinutes),
      bufferAfterMinutes: Math.max(0, Math.round(input.bufferAfterMinutes)),
      priceAmount: Math.round(input.priceAmount),
      currency: input.currency.trim() === "" ? "EUR" : input.currency.trim().toUpperCase(),
    });
    if (!result.ok || result.data === undefined) {
      return { ok: false, error: result.error ?? "No se pudo crear el servicio." };
    }
    return { ok: true, value: toAdmin(result.data, categoryName) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al crear el servicio.",
    };
  }
}

export async function setServiceActive(
  id: string,
  active: boolean,
): Promise<StoreResult<AdminService>> {
  if (dataMode() === "demo") {
    return demoSetServiceActive(id, active);
  }
  const result = await apiSend<ApiService>("PATCH", `/v1/admin/services/${id}`, { active });
  if (!result.ok || result.data === undefined) {
    return { ok: false, error: result.error ?? "No se pudo actualizar el servicio." };
  }
  const service = result.data;
  // The PATCH response carries categoryId; resolve its name for the console DTO.
  const categories = await listCategories();
  const categoryName =
    categories.find((category) => category.id === service.categoryId)?.name ?? "General";
  return { ok: true, value: toAdmin(service, categoryName) };
}
