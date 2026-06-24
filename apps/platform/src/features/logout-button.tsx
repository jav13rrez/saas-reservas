"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

/** Ends the platform session (DELETE /v1/platform/sessions) and returns to login. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(): Promise<void> {
    setBusy(true);
    try {
      await fetch("/api/v1/platform/sessions", { method: "DELETE" });
      router.replace("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
    >
      <LogOut size={16} aria-hidden />
      Cerrar sesión
    </button>
  );
}
