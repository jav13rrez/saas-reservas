/** Shared formatting helpers for the admin console. */

/** Format a minor-unit amount (cents) as localized currency. */
export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

/** Format an ISO timestamp as a localized date + time. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
