# Prompt de Inicio de Sesión

Pega este prompt al arrancar cualquier sesión nueva (Claude, Codex u otro modelo).
Está diseñado para que el agente se oriente solo a partir de los documentos de
flujo del repo, sin asumir herramientas de ningún proveedor concreto.

Si prefieres que el agente arranque a programar directamente, cambia el último
párrafo por: *"…dame el resumen y procede con la próxima acción prioritaria"*.

---

```text
Eres un agente trabajando en el repositorio saas-reservas (SaaS multitenant de
reservas, inspirado en Amelia Premium, cloud-native e independiente de WordPress).

Antes de proponer o tocar nada, reconstruye contexto leyendo estos documentos EN
ESTE ORDEN (de lo más inmediato a lo más fundacional):

  1. HANDOFF.md            — punto de reanudación, próximas acciones, blockers.
  2. PLANNING.md           — mapa del proyecto, ruta post-spec, modelo operativo.
  3. PROGRESS.md           — historial cronológico de lo hecho.
  4. .specify/memory/constitution.md — principios no negociables.
  5. specs/001-saas-multitenant-booking/plan.md  — plan técnico y arquitectura.
  6. specs/001-saas-multitenant-booking/tasks.md — backlog de tareas.

Apoyo según contexto:
  - docs/analysis/amelia-ux-reference.md — LEER antes de diseñar cualquier UI o
    feature nueva. Es el barrido completo del admin de Amelia (referencia UX, no
    código). Sus "Decisiones pendientes" marcan lo que falta por decidir.
  - docs/adr/ (ADR-0001 a ADR-0017) — el porqué de cada decisión de arquitectura.
    El modelo de recursos vigente es el HUB de ADR-0016; la auth de staff es ADR-0017.

Estado actual (a fecha de este prompt): las tareas de spec T001–T086 están
COMPLETAS. El trabajo es post-spec (productivización). Ya completado: migración
de la capa canónica al modelo HUB de recursos (ADR-0016, incl. drop del modelo B
legacy y ubicaciones de proveedor), auth de staff para /v1/admin/* (ADR-0017) y
bootstrap de servidor de producción (main.ts: modo Drizzle/Redis o in-memory).
Las próximas acciones están priorizadas en PLANNING.md > "Immediate Route" y
HANDOFF.md; quedan: adaptadores reales (Stripe Connect, email/SMS/WhatsApp, KMS,
S3) y profundidad de producto (agenda por proveedor, quantity partition, group
booking).

Contexto de operación (importante): el dueño del repo viene de Supabase+Vercel y
está en fase de onboarding — arrancando el proyecto en local por primera vez. El
panel admin (apps/admin) ya corre en su máquina con `pnpm --filter
@saas-reservas/admin dev` (Node 22). El siguiente paso acordado es la "Parte 2":
levantar el stack completo en local (Postgres + Redis vía Docker + el API).
Guías de apoyo: docs/operations/SETUP.md (checklist de operador) y .env.example.
Prefiere explicaciones paso a paso, detalladas y en español.

Reglas de operación (de CLAUDE.md / AGENTS.md):
  - Spec Kit es la fuente de verdad de producto. PLANNING/PROGRESS/HANDOFF son la
    capa de continuidad entre agentes: actualízalos antes de cerrar una sesión con
    cambios relevantes; si completas tareas, actualiza tasks.md; si tomas una
    decisión de arquitectura, registra un ADR en docs/adr/.
  - Toda UI sigue docs/design-system.md (ADR-0008): tokens de packages/ui, iconos
    solo de lucide-react, sin emojis en UI ni en strings de usuario.
  - No trates reference/ ni archive/ como código fuente (son research local).
  - NO hagas push, merge, publicación, borrado de material de referencia ni cambio
    de credenciales sin mi aprobación explícita.
  - No commitees fuente de Amelia Premium, salidas pesadas de Graphify ni secretos.

Cuando termines de leer, NO empieces a programar todavía: dame un resumen breve de
(a) dónde está el proyecto, (b) qué entiendes que es la próxima acción prioritaria,
y (c) qué necesitas de mí para continuar. Espera mi confirmación antes de actuar.
```

---

## Notas de mantenimiento

- La línea **"Estado actual"** del prompt es lo único con fecha implícita: cuando
  el estado del proyecto cambie de forma relevante (p.ej. se complete la migración
  hub canónica), actualiza ese párrafo y el rango de ADRs.
- El orden de lectura coincide con el declarado en `CLAUDE.md` y `AGENTS.md`. Si
  cambias el orden en uno, cámbialo en los tres.
