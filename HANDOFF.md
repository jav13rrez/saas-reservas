# Handoff

Last updated: 2026-06-24 (US2)

> **Qué es este archivo:** el punto de reanudación corto para el siguiente agente
> (estado, próximas acciones, blockers). **No es un diario** — el historial
> cronológico vive en `PROGRESS.md`; el mapa y el modelo operativo en `PLANNING.md`;
> el backlog de features (por área del sidebar) en
> `docs/analysis/menu-walkthrough-gap-analysis.md`.

## Punto de reanudación (2026-06-24 — feature 002 US2 implementada)

- **Rama de trabajo:** `claude/affectionate-wright-0vx6ka` — **VIVA y empujada a `origin`** (no
  fusionada, no borrar). Continuar en esta rama.
- **Spec 001 completa** (T001–T086) fusionada en `main`. Suite verde.
- **Feature 002 — US1 (T001–T016) + US2 (T017–T022) COMPLETADAS:**
  - **US1:** identidad platform-global + gate `/v1/platform/*` y `/v1/ops/*` + bootstrap operador
    + login/logout + `apps/platform` (login + dashboard). Quickstart S1–S2 validados.
  - **US2:** ciclo de vida de tenant implementado y validado (Quickstart S3–S4 en terminal curl):
    - `TenantAdminService.updateStatus()` + `listTenants()` (port + InMemoryStore + DrizzleTenantRepository).
    - `PATCH /v1/platform/tenants/:tenantId` (200 active/suspended, 404 not-found, actor desde sesión).
    - `GET /v1/platform/tenants` (list para la UI de plataforma).
    - `tenant-resolver.ts`: reason `"tenant-suspended"` distinguido de `"tenant-inactive"`; ambos → 403.
    - `apps/platform`: página `/dashboard/tenants` (list + create + suspend/reactivate), enlace desde dashboard.
  - Tests: suite total **334 passing, 7 skipped** (sin Postgres/Redis en entorno remoto), 54 archivos.
- **Pendiente de la 002 (NO hecho, próximos incrementos):** US3 (Fase 5: mover Operaciones de
  `apps/admin` a `apps/platform` + realinear al DS), US4 (Fase 6: vínculo proveedor↔staff,
  paralelizable), Polish (Fase 7).
- **Dirección de producto:** pagos pausados; prioridad = **camino a un MVP desplegable**.

## Próximas acciones (priorizadas) — PRÓXIMA SESIÓN

> **→ Empieza por aquí:** continuar la feature 002 con **US3 (Fase 5, T023–T026)**.

1. **Continuar la 002** siguiendo `tasks.md`, tests primero (constitución):
   - **US3 (Fase 5, T023–T026)**: mover la vista `/operations` de `apps/admin` a `apps/platform`
     (lectura cross-tenant por el path global, sin ensanchar RLS) + realinear al DS; quitarla de
     `apps/admin`. Validar quickstart S5.
   - **US4 (Fase 6, T027–T031, paralelizable)**: vínculo opcional 1-a-1 `staff_accounts.provider_id`.
   - **Polish (Fase 7)**.
2. **Tras 002** (clúster MVP): `tenant-settings`, `reservas-ciclo-estados-pagos`, worker de
   notificaciones email (Brevo wired; falta bootstrap + dispatcher email). Detalle en el gap-analysis.

## Blockers / notas de entorno

- **Email worker** sin bootstrap (Brevo ADR-0020 listo); dispatcher arma SMS y no cae a
  email. Ver `TECH_DEBT.md`.
- **Seguridad:** gate de plataforma (US1) ya protege `/v1/platform/*` y `/v1/ops/*`. Aún
  **pendiente US3**: la vista `/operations` sigue viviendo en `apps/admin`.
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
- **Feature en curso (US1+US2 implementadas; US3–US4 pendientes):** `specs/002-plataforma-superadmin/`.
- **Arranque de sesión:** `docs/START_PROMPT.md`.

## Suggested skills (próximo agente)

- `/speckit-implement` la feature 002 desde **US3 (Fase 5)** — US1+US2 ya están implementadas.
- `/speckit-specify` — para las siguientes features del clúster (`tenant-settings`,
  `reservas-ciclo-estados-pagos`) tras completar la 002.
- `/handoff` — al cerrar la sesión, para refrescar este archivo.

## Reglas de cierre de sesión

Antes de cerrar con cambios relevantes: actualizar `PROGRESS.md` (entrada fechada) y este
`HANDOFF.md`; si se completan tareas, marcar `tasks.md`; si se decide arquitectura, añadir
un ADR. No hacer push/merge/borrado de referencia ni cambio de credenciales sin aprobación
explícita del dueño.
