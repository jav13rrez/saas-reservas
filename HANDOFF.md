# Handoff

Last updated: 2026-06-25 (US3)

> **Qué es este archivo:** el punto de reanudación corto para el siguiente agente
> (estado, próximas acciones, blockers). **No es un diario** — el historial
> cronológico vive en `PROGRESS.md`; el mapa y el modelo operativo en `PLANNING.md`;
> el backlog de features (por área del sidebar) en
> `docs/analysis/menu-walkthrough-gap-analysis.md`.

## Punto de reanudación (2026-06-25 — feature 002 US3 implementada)

- **Rama de trabajo:** `claude/affectionate-wright-0vx6ka` — **VIVA y empujada a `origin`** (no
  fusionada, no borrar). Continuar en esta rama.
- **Spec 001 completa** (T001–T086) fusionada en `main`. Suite verde.
- **Feature 002 — US1 (T001–T016) + US2 (T017–T022) + US3 (T023–T026) COMPLETADAS:**
  - **US1:** identidad platform-global + gate `/v1/platform/*` y `/v1/ops/*` + bootstrap operador
    + login/logout + `apps/platform` (login + dashboard). Quickstart S1–S2 validados.
  - **US2:** ciclo de vida de tenant (provision, suspend/reactivate) + UI en `apps/platform`.
    Quickstart S3–S4 validados.
  - **US3:** vista de Operaciones movida de `apps/admin` a `apps/platform`:
    - `tests/integration/operations/ops-access.test.ts`: gate 401/403/200 verde.
    - `apps/platform/src/features/operations/operations-dashboard.tsx` + `/dashboard/operations`
      (server component, DS tokens, lucide-react, español, sin Tailwind).
    - `apps/admin`: eliminados `/operations` page, `features/operations/`, `api/ops/tenants/`,
      entrada del sidebar. Ya no expone la vista de operaciones.
    - Dashboard platform (`/dashboard`) con enlace a Operaciones.
  - Tests: suite total **338 passing, 7 skipped** (sin Postgres/Redis en entorno remoto), 55 archivos.
- **Pendiente de la 002 (NO hecho, próximos incrementos):**
  - **US4 (Fase 6, T027–T031)**: vínculo opcional 1-a-1 `staff_accounts.provider_id`.
  - **Polish (Fase 7, T032–T034)**: docs, quickstart final, PROGRESS/HANDOFF.

## Próximas acciones (priorizadas) — PRÓXIMA SESIÓN

> **→ Empieza por aquí:** continuar la feature 002 con **US4 (Fase 6, T027–T031)**.

1. **Continuar la 002** siguiendo `tasks.md`, tests primero (constitución):
   - **US4 (Fase 6, T027–T031)**: vínculo opcional 1-a-1 `staff_accounts.provider_id` (FK +
     partial unique index, port methods, rutas PATCH, UI en `apps/admin`).
   - **Polish (Fase 7, T032–T034)**: docs finales + aceptación quickstart S1–S6 contra stack local.
2. **Tras 002** (clúster MVP): `tenant-settings`, `reservas-ciclo-estados-pagos`, worker de
   notificaciones email (Brevo wired; falta bootstrap + dispatcher email). Detalle en el gap-analysis.

## Blockers / notas de entorno

- **Email worker** sin bootstrap (Brevo ADR-0020 listo); dispatcher arma SMS y no cae a
  email. Ver `TECH_DEBT.md`.
- **Pre-VPS:** deudas en `TECH_DEBT.md` (rol app `NOSUPERUSER NOBYPASSRLS` validado;
  falta migration runner). Leer antes de planificar deploy.
- **Operador (su máquina):** Stripe CLI logueado + `whsec_…` en `.env` local, preparado
  pero sin usar hasta deploy. Trato: principiante, español, **un comando por vez**, sin
  bloques multilínea grandes.
- **Entorno remoto:** el servidor de firma de commits dio 503 intermitente (reintentar
  el commit resuelve).

## Punteros (dónde vive cada cosa)

- **Continuidad:** `HANDOFF.md` (esto) · `PROGRESS.md` (diario) · `PLANNING.md` (mapa+modelo).
- **Producto (feature fundacional):** `specs/001-saas-multitenant-booking/` (Spec-Kit).
- **Backlog de crecimiento:** `docs/analysis/menu-walkthrough-gap-analysis.md` (índice de features).
- **Investigación Amelia:** `docs/analysis/amelia-*-fine-grained.md` + `amelia-ux-reference.md`.
- **Decisiones:** `docs/adr/0001…0022`. **Constitución:** `.specify/memory/constitution.md`.
- **Feature en curso (US1+US2+US3 implementadas; US4 pendiente):** `specs/002-plataforma-superadmin/`.
- **Arranque de sesión:** `docs/START_PROMPT.md`.

## Suggested skills (próximo agente)

- `/speckit-implement` la feature 002 desde **US4 (Fase 6)** — US1+US2+US3 ya están implementadas.
- `/speckit-specify` — para las siguientes features del clúster (`tenant-settings`,
  `reservas-ciclo-estados-pagos`) tras completar la 002.
- `/handoff` — al cerrar la sesión, para refrescar este archivo.

## Reglas de cierre de sesión

Antes de cerrar con cambios relevantes: actualizar `PROGRESS.md` (entrada fechada) y este
`HANDOFF.md`; si se completan tareas, marcar `tasks.md`; si se decide arquitectura, añadir
un ADR. No hacer push/merge/borrado de referencia ni cambio de credenciales sin aprobación
explícita del dueño.
