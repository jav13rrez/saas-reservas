/**
 * Customer data source (ADR-0018 Phase 2): demo store or persistent API, chosen
 * by ADMIN_DATA_MODE. Same signatures the route handlers use against the demo
 * store, so handlers only swap their import.
 *
 * The console works with a single `name`; the domain Customer stores
 * `firstName`/`lastName` and has no active flag or createdAt. This module owns
 * the name split/join and maps `active` to the GDPR status. The active toggle is
 * not yet supported in API mode (no domain concept); it returns a clear error.
 */

import { dataMode } from "../config";
import {
  createCustomer as demoCreateCustomer,
  listCustomers as demoListCustomers,
  setCustomerActive as demoSetCustomerActive,
  type AdminCustomer,
  type CreateCustomerInput,
  type StoreResult,
} from "../demo-store";
import { apiGet, apiSend } from "../api-client";

interface ApiCustomer {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gdprStatus: "active" | "anonymized";
}

function toAdmin(customer: ApiCustomer): AdminCustomer {
  const name = [customer.firstName, customer.lastName]
    .filter((part) => part.trim() !== "")
    .join(" ");
  return {
    id: customer.id,
    name,
    email: customer.email,
    active: customer.gdprStatus === "active",
    // The domain has no creation timestamp; the console does not display it.
    createdAt: "",
    ...(customer.phone !== undefined ? { phone: customer.phone } : {}),
  };
}

/** Split a single display name into first + last (everything after the first token). */
function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() ?? "";
  return { firstName, lastName: parts.join(" ") };
}

export async function listCustomers(): Promise<AdminCustomer[]> {
  if (dataMode() === "demo") {
    return demoListCustomers();
  }
  const result = await apiGet<{ items: ApiCustomer[] }>("/v1/admin/customers");
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? "No se pudieron cargar los clientes.");
  }
  return result.data.items.map(toAdmin).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<StoreResult<AdminCustomer>> {
  if (dataMode() === "demo") {
    return demoCreateCustomer(input);
  }
  const { firstName, lastName } = splitName(input.name);
  const body: Record<string, string> = { email: input.email.trim(), firstName, lastName };
  if (input.phone.trim() !== "") {
    body.phone = input.phone.trim();
  }
  const result = await apiSend<ApiCustomer>("POST", "/v1/admin/customers", body);
  if (!result.ok || result.data === undefined) {
    const error =
      result.status === 409
        ? "Ya existe un cliente con ese email."
        : (result.error ?? "No se pudo crear el cliente.");
    return { ok: false, error };
  }
  return { ok: true, value: toAdmin(result.data) };
}

export function setCustomerActive(
  id: string,
  active: boolean,
): Promise<StoreResult<AdminCustomer>> {
  if (dataMode() === "demo") {
    return Promise.resolve(demoSetCustomerActive(id, active));
  }
  // No domain concept yet (ADR-0018): customers are active or GDPR-anonymized.
  return Promise.resolve({
    ok: false,
    error: "Activar o desactivar clientes no está disponible en modo API todavía.",
  });
}
