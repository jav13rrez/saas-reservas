"use client";

/**
 * Configuración del tenant (feature 003). A real settings surface over the
 * tenant aggregate: Perfil, Localización (zona horaria, idioma, moneda),
 * Políticas de reserva, y Marca. One Save sends a single all-or-nothing PATCH
 * to /api/settings. Replaces the old sign-up wizard on this route.
 *
 * Styling reads design tokens; icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useState } from "react";
import { Building2, Globe, CalendarClock, Palette, Save, RefreshCw } from "lucide-react";

interface Settings {
  profile: { displayName: string };
  localization: { defaultTimezone: string; defaultLocale: string; currency: string };
  policies: {
    cancellationMinNoticeHours: number;
    rescheduleMinNoticeHours: number;
    bookingHorizonDays: number;
    requiresApproval: boolean;
  };
  branding: { primaryColor: string; logoUrl?: string };
}

const CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CAD",
  "AUD",
  "MXN",
  "BRL",
  "JPY",
];

const card: React.CSSProperties = {
  background: "var(--ui-color-surface)",
  border: "1px solid var(--ui-color-border)",
  borderRadius: "var(--ui-radius-lg)",
  padding: "var(--ui-space-5)",
  marginBottom: "var(--ui-space-5)",
};

const sectionTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--ui-space-2)",
  marginTop: 0,
};

const row: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--ui-space-4)",
  alignItems: "flex-end",
};

export function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        throw new Error("No se pudo cargar la configuración.");
      }
      setSettings((await res.json()) as Settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch<K extends keyof Settings>(group: K, value: Partial<Settings[K]>): void {
    setSettings((s) => (s === null ? s : { ...s, [group]: { ...s[group], ...value } }));
    setSaved(false);
  }

  async function handleSave(event: { preventDefault(): void }): Promise<void> {
    event.preventDefault();
    if (settings === null) {
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = (await res.json()) as Settings & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Guardado falló con ${String(res.status)}`);
      }
      setSettings(body);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
        <Building2 size={20} aria-hidden />
        Configuración
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 640 }}>
        Ajustes del negocio: perfil, localización, políticas de reserva y marca.
      </p>

      {loading || settings === null ? (
        <p role="status">Cargando…</p>
      ) : (
        <form onSubmit={(e) => void handleSave(e)}>
          <div style={card}>
            <h2 style={sectionTitle}>
              <Building2 size={18} aria-hidden /> Perfil
            </h2>
            <label>
              Nombre del negocio
              <input
                value={settings.profile.displayName}
                onChange={(e) => {
                  patch("profile", { displayName: e.target.value });
                }}
                required
              />
            </label>
          </div>

          <div style={card}>
            <h2 style={sectionTitle}>
              <Globe size={18} aria-hidden /> Localización
            </h2>
            <div style={row}>
              <label>
                Zona horaria
                <input
                  value={settings.localization.defaultTimezone}
                  onChange={(e) => {
                    patch("localization", { defaultTimezone: e.target.value });
                  }}
                  placeholder="Europe/Madrid"
                />
              </label>
              <label>
                Idioma
                <input
                  value={settings.localization.defaultLocale}
                  onChange={(e) => {
                    patch("localization", { defaultLocale: e.target.value });
                  }}
                  placeholder="es-ES"
                />
              </label>
              <label>
                Moneda
                <select
                  value={settings.localization.currency}
                  onChange={(e) => {
                    patch("localization", { currency: e.target.value });
                  }}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p style={{ color: "var(--ui-color-text-muted)", fontSize: "var(--ui-text-sm)" }}>
              Cambiar la moneda no afecta a reservas ni pagos ya existentes; solo a los nuevos.
            </p>
          </div>

          <div style={card}>
            <h2 style={sectionTitle}>
              <CalendarClock size={18} aria-hidden /> Políticas de reserva
            </h2>
            <div style={row}>
              <label>
                Horizonte de reserva (días)
                <input
                  type="number"
                  min={1}
                  value={settings.policies.bookingHorizonDays}
                  onChange={(e) => {
                    patch("policies", { bookingHorizonDays: Number(e.target.value) });
                  }}
                />
              </label>
              <label>
                Antelación de cancelación (horas)
                <input
                  type="number"
                  min={0}
                  value={settings.policies.cancellationMinNoticeHours}
                  onChange={(e) => {
                    patch("policies", { cancellationMinNoticeHours: Number(e.target.value) });
                  }}
                />
              </label>
              <label>
                Antelación de reprogramación (horas)
                <input
                  type="number"
                  min={0}
                  value={settings.policies.rescheduleMinNoticeHours}
                  onChange={(e) => {
                    patch("policies", { rescheduleMinNoticeHours: Number(e.target.value) });
                  }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
                <input
                  type="checkbox"
                  checked={settings.policies.requiresApproval}
                  onChange={(e) => {
                    patch("policies", { requiresApproval: e.target.checked });
                  }}
                />
                Requiere aprobación
              </label>
            </div>
          </div>

          <div style={card}>
            <h2 style={sectionTitle}>
              <Palette size={18} aria-hidden /> Marca
            </h2>
            <div style={row}>
              <label>
                Color primario
                <input
                  value={settings.branding.primaryColor}
                  onChange={(e) => {
                    patch("branding", { primaryColor: e.target.value });
                  }}
                  placeholder="#1f6feb"
                />
              </label>
              <input
                type="color"
                aria-label="Selector de color primario"
                value={settings.branding.primaryColor}
                onChange={(e) => {
                  patch("branding", { primaryColor: e.target.value });
                }}
                style={{ height: 38, width: 48, padding: 0 }}
              />
              <label>
                Logo (referencia)
                <input
                  value={settings.branding.logoUrl ?? ""}
                  onChange={(e) => {
                    patch("branding", { logoUrl: e.target.value });
                  }}
                  placeholder="tenants/…/logo.png"
                />
              </label>
            </div>
          </div>

          {error !== null && (
            <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
              {error}
            </p>
          )}
          {saved && (
            <p role="status" style={{ color: "var(--ui-color-success)" }}>
              Configuración guardada.
            </p>
          )}

          <div style={{ display: "flex", gap: "var(--ui-space-3)" }}>
            <button
              type="submit"
              disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
            >
              <Save size={16} aria-hidden />
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--ui-space-2)" }}
            >
              <RefreshCw size={14} aria-hidden />
              Descartar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
