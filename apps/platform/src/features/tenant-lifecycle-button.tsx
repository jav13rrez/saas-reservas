"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle } from "lucide-react";

interface Props {
  tenantId: string;
  currentStatus: "active" | "suspended";
}

/**
 * Suspend / reactivate button for a single tenant (US2, FR-021).
 * Calls PATCH /api/v1/platform/tenants/:id and refreshes the list.
 */
export function TenantLifecycleButton({ tenantId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = currentStatus === "active" ? "suspended" : "active";
  const label = currentStatus === "active" ? "Suspender" : "Reactivar";
  const Icon = currentStatus === "active" ? PauseCircle : PlayCircle;

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/platform/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        setError("No se pudo actualizar el estado del tenant.");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        disabled={loading}
        onClick={() => void toggle()}
        style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-1)" }}
      >
        <Icon size={14} aria-hidden />
        {loading ? "…" : label}
      </button>
      {error !== null && (
        <span
          role="alert"
          style={{
            marginLeft: "var(--ui-space-2)",
            color: "var(--ui-color-danger)",
            fontSize: "0.85em",
          }}
        >
          {error}
        </span>
      )}
    </span>
  );
}
