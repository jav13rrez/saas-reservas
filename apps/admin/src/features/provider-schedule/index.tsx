"use client";

/**
 * Provider schedule editor (Work hours / Days off / Special days) — the per
 * provider agenda that was a known gap vs. Amelia. Talks to
 * /api/providers/:id/schedule (GET to load, PUT to replace).
 *
 * Entries mirror the domain ProviderScheduleEntry: weekly working windows with
 * breaks, day-off dates, and special-day overrides. Styling reads design tokens;
 * icons from lucide-react only. No emojis.
 */

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

interface ScheduleBreak {
  start: string;
  end: string;
}
type ScheduleEntry =
  | { kind: "weekly"; weekday: number; startTime: string; endTime: string; breaks: ScheduleBreak[] }
  | {
      kind: "special-day";
      date: string;
      startTime: string;
      endTime: string;
      breaks: ScheduleBreak[];
    }
  | { kind: "day-off"; date: string };

interface WeeklyDay {
  weekday: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
  breaks: ScheduleBreak[];
}
interface SpecialDay {
  date: string;
  startTime: string;
  endTime: string;
  breaks: ScheduleBreak[];
}

// Monday-first display order; domain weekday is 0=Sunday..6=Saturday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABEL: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  0: "Domingo",
};

const CARD: React.CSSProperties = {
  background: "var(--ui-color-surface)",
  border: "1px solid var(--ui-color-border)",
  borderRadius: "var(--ui-radius-lg)",
  padding: "var(--ui-space-4)",
  margin: "var(--ui-space-4) 0",
};

function emptyWeek(): WeeklyDay[] {
  return WEEK_ORDER.map((weekday) => ({
    weekday,
    enabled: false,
    startTime: "09:00",
    endTime: "17:00",
    breaks: [],
  }));
}

export function ProviderSchedule({ providerId }: { providerId: string }) {
  const [week, setWeek] = useState<WeeklyDay[]>(emptyWeek());
  const [daysOff, setDaysOff] = useState<string[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/providers/${providerId}/schedule`);
      if (!res.ok) {
        throw new Error("No se pudo cargar la agenda.");
      }
      const entries = ((await res.json()) as { entries: ScheduleEntry[] }).entries;
      const nextWeek = emptyWeek();
      const offs: string[] = [];
      const specials: SpecialDay[] = [];
      for (const entry of entries) {
        if (entry.kind === "weekly") {
          const day = nextWeek.find((d) => d.weekday === entry.weekday);
          if (day !== undefined) {
            day.enabled = true;
            day.startTime = entry.startTime;
            day.endTime = entry.endTime;
            day.breaks = entry.breaks;
          }
        } else if (entry.kind === "day-off") {
          offs.push(entry.date);
        } else {
          specials.push({
            date: entry.date,
            startTime: entry.startTime,
            endTime: entry.endTime,
            breaks: entry.breaks,
          });
        }
      }
      setWeek(nextWeek);
      setDaysOff(offs);
      setSpecialDays(specials);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    void load();
  }, [load]);

  function patchDay(weekday: number, patch: Partial<WeeklyDay>) {
    setWeek((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const entries: ScheduleEntry[] = [
      ...week
        .filter((d) => d.enabled)
        .map<ScheduleEntry>((d) => ({
          kind: "weekly",
          weekday: d.weekday,
          startTime: d.startTime,
          endTime: d.endTime,
          breaks: d.breaks,
        })),
      ...daysOff
        .filter((date) => date !== "")
        .map<ScheduleEntry>((date) => ({ kind: "day-off", date })),
      ...specialDays
        .filter((s) => s.date !== "")
        .map<ScheduleEntry>((s) => ({
          kind: "special-day",
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          breaks: s.breaks,
        })),
    ];
    try {
      const res = await fetch(`/api/providers/${providerId}/schedule`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Guardado falló con ${String(res.status)}`);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p role="status">Cargando agenda…</p>;
  }

  return (
    <section>
      <h1 style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)" }}>
        <CalendarClock size={20} aria-hidden />
        Agenda del proveedor
      </h1>
      <p style={{ color: "var(--ui-color-text-muted)", maxWidth: 640 }}>
        Define el horario semanal, los días libres y los días con horario especial. La
        disponibilidad pública se calcula a partir de estas reglas.
      </p>

      {error !== null && (
        <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
          {error}
        </p>
      )}
      {saved && <p style={{ color: "var(--ui-color-success)" }}>Agenda guardada.</p>}

      <div style={CARD}>
        <h2>Horario semanal</h2>
        {week.map((day) => (
          <div
            key={day.weekday}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "var(--ui-space-3)",
              padding: "var(--ui-space-2) 0",
              borderBottom: "1px solid var(--ui-color-border)",
            }}
          >
            <label style={{ minWidth: 150, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={day.enabled}
                onChange={(e) => {
                  patchDay(day.weekday, { enabled: e.target.checked });
                }}
              />
              {WEEKDAY_LABEL[day.weekday]}
            </label>
            {day.enabled && (
              <>
                <input
                  type="time"
                  value={day.startTime}
                  onChange={(e) => {
                    patchDay(day.weekday, { startTime: e.target.value });
                  }}
                  aria-label={`Inicio ${WEEKDAY_LABEL[day.weekday] ?? ""}`}
                />
                <span>—</span>
                <input
                  type="time"
                  value={day.endTime}
                  onChange={(e) => {
                    patchDay(day.weekday, { endTime: e.target.value });
                  }}
                  aria-label={`Fin ${WEEKDAY_LABEL[day.weekday] ?? ""}`}
                />
                <BreakEditor
                  breaks={day.breaks}
                  onChange={(breaks) => {
                    patchDay(day.weekday, { breaks });
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>

      <div style={CARD}>
        <h2>Días libres</h2>
        {daysOff.length === 0 && (
          <p style={{ color: "var(--ui-color-text-muted)" }}>Sin días libres.</p>
        )}
        {daysOff.map((date, index) => (
          <div
            key={index}
            style={{ display: "flex", alignItems: "center", gap: "var(--ui-space-2)", padding: 4 }}
          >
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDaysOff((prev) => prev.map((d, i) => (i === index ? e.target.value : d)));
              }}
              aria-label="Fecha del día libre"
            />
            <button
              type="button"
              onClick={() => {
                setDaysOff((prev) => prev.filter((_, i) => i !== index));
              }}
              aria-label="Quitar día libre"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setDaysOff((prev) => [...prev, ""]);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8 }}
        >
          <Plus size={14} aria-hidden />
          Añadir día libre
        </button>
      </div>

      <div style={CARD}>
        <h2>Días especiales</h2>
        {specialDays.length === 0 && (
          <p style={{ color: "var(--ui-color-text-muted)" }}>Sin días especiales.</p>
        )}
        {specialDays.map((special, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "var(--ui-space-2)",
              padding: "var(--ui-space-2) 0",
              borderBottom: "1px solid var(--ui-color-border)",
            }}
          >
            <input
              type="date"
              value={special.date}
              onChange={(e) => {
                setSpecialDays((prev) =>
                  prev.map((s, i) => (i === index ? { ...s, date: e.target.value } : s)),
                );
              }}
              aria-label="Fecha del día especial"
            />
            <input
              type="time"
              value={special.startTime}
              onChange={(e) => {
                setSpecialDays((prev) =>
                  prev.map((s, i) => (i === index ? { ...s, startTime: e.target.value } : s)),
                );
              }}
              aria-label="Inicio día especial"
            />
            <span>—</span>
            <input
              type="time"
              value={special.endTime}
              onChange={(e) => {
                setSpecialDays((prev) =>
                  prev.map((s, i) => (i === index ? { ...s, endTime: e.target.value } : s)),
                );
              }}
              aria-label="Fin día especial"
            />
            <BreakEditor
              breaks={special.breaks}
              onChange={(breaks) => {
                setSpecialDays((prev) => prev.map((s, i) => (i === index ? { ...s, breaks } : s)));
              }}
            />
            <button
              type="button"
              onClick={() => {
                setSpecialDays((prev) => prev.filter((_, i) => i !== index));
              }}
              aria-label="Quitar día especial"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setSpecialDays((prev) => [
              ...prev,
              { date: "", startTime: "09:00", endTime: "17:00", breaks: [] },
            ]);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8 }}
        >
          <Plus size={14} aria-hidden />
          Añadir día especial
        </button>
      </div>

      <div style={{ display: "flex", gap: "var(--ui-space-3)" }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Save size={16} aria-hidden />
          {saving ? "Guardando…" : "Guardar agenda"}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} aria-hidden />
          Descartar cambios
        </button>
      </div>
    </section>
  );
}

/** Add/remove breaks (HH:mm ranges) within a working window. */
function BreakEditor({
  breaks,
  onChange,
}: {
  breaks: ScheduleBreak[];
  onChange: (breaks: ScheduleBreak[]) => void;
}) {
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      {breaks.map((brk, index) => (
        <span key={index} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "var(--ui-color-text-muted)", fontSize: "var(--ui-text-sm)" }}>
            descanso
          </span>
          <input
            type="time"
            value={brk.start}
            onChange={(e) => {
              onChange(breaks.map((b, i) => (i === index ? { ...b, start: e.target.value } : b)));
            }}
            aria-label="Inicio descanso"
          />
          <input
            type="time"
            value={brk.end}
            onChange={(e) => {
              onChange(breaks.map((b, i) => (i === index ? { ...b, end: e.target.value } : b)));
            }}
            aria-label="Fin descanso"
          />
          <button
            type="button"
            onClick={() => {
              onChange(breaks.filter((_, i) => i !== index));
            }}
            aria-label="Quitar descanso"
          >
            <Trash2 size={12} aria-hidden />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => {
          onChange([...breaks, { start: "13:00", end: "14:00" }]);
        }}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <Plus size={12} aria-hidden />
        Descanso
      </button>
    </span>
  );
}
