# Handoff

Last updated: 2026-06-24

> **Qué es este archivo:** el punto de reanudación corto para el siguiente agente
> (estado, próximas acciones, blockers). **No es un diario** — el historial
> cronológico vive en `PROGRESS.md`; el mapa y el modelo operativo en `PLANNING.md`;
> el backlog de features (por área del sidebar) en
> `docs/analysis/menu-walkthrough-gap-analysis.md`.

## Punto de reanudación (2026-06-24 — sesión CERRADA)

> **⏸️ PARADA DELIBERADA.** El dueño detectó que **varios `docs/analysis/amelia-*-fine-grained.md`
> no quedaron lo bastante profundos**. Volverá con **todos** ellos documentados a fondo. Hasta
> entonces, la **implementación de la feature 002 está EN PAUSA** (la planificación está completa,
> pero podría necesitar revisión a la luz de la referencia Amelia más profunda).

- **Rama de trabajo:** `claude/affectionate-wright-0vx6ka` — **VIVA y empujada a `origin`** (no
  fusionada, no borrar). Todo el trabajo de la sesión está commiteado y firmado ahí. Continuar en
  esta misma rama la próxima sesión.
- **Spec 001 completa** (T001–T086) fusionada en `main`. Suite verde (~318 tests). Stack local
  validado E2E (Postgres+Redis+API; admin en `demo` y en `api`).
- **Esta sesión (2026-06-24):**
  1. **8 decisiones transversales resueltas** → **ADR-0021** (gap-analysis marcado).
  2. **Feature `002-plataforma-superadmin` planificada de punta a punta**:
     `/speckit-specify` + `/speckit-clarify` + `/speckit-plan` + `/speckit-tasks` →
     `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/platform-api.md`,
     `quickstart.md`, `tasks.md` (34 tareas, 7 fases, tests primero, MVP = US1). Arquitectura en
     **ADR-0022** (app separada `apps/platform`, identidad platform-global, gate, bootstrap
     autobloqueante, suspensión, vínculo proveedor↔staff). **Constitución PASS. Aún SIN implementar.**
- **Dirección de producto:** pagos pausados; prioridad = **camino a un MVP desplegable**.

## Próximas acciones (priorizadas) — PRÓXIMA SESIÓN

> **→ Empieza por aquí:** el dueño traerá los `amelia-*-fine-grained.md` profundizados.

1. **Releer los `docs/analysis/amelia-*-fine-grained.md` profundizados** (los que el dueño rehaga).
   Identificar qué áreas ganaron detalle frente a la versión usada hasta ahora.
2. **Reevaluar la feature 002 a la luz de esa referencia más profunda** ANTES de implementar:
   ¿cambian `spec.md`/`plan.md`/`tasks.md` de `plataforma-superadmin`? Si sí, actualizar con
   `/speckit-clarify` o re-`/speckit-plan`/`/speckit-tasks`; si no, seguir.
3. **Solo entonces** `/speckit-implement` la 002 (empezar por Setup + Foundational + US1; US4 es
   paralelizable).
4. **Siguientes features del clúster MVP** (tras 002): `tenant-settings`,
   `reservas-ciclo-estados-pagos`, worker de notificaciones email (Brevo wired; falta bootstrap +
   dispatcher email). Detalle en el gap-analysis.

## Blockers / notas de entorno

- **Email worker** sin bootstrap (Brevo ADR-0020 listo); dispatcher arma SMS y no cae a
  email. Ver `TECH_DEBT.md`.
- **Seguridad:** `/operations` (cross-tenant) vive en `apps/admin` sin auth; provisión de
  tenants (`POST /v1/platform/tenants`) abierta. Resolver con `plataforma-superadmin`.
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
- **Feature en curso (planificada, sin implementar):** `specs/002-plataforma-superadmin/`.
- **Arranque de sesión:** `docs/START_PROMPT.md`.

## Suggested skills (próximo agente)

- **Primero (esta vez):** leer los `docs/analysis/amelia-*-fine-grained.md` profundizados que traiga
  el dueño y reevaluar la feature 002 antes de tocar código.
- `/speckit-clarify` y/o re-`/speckit-plan`/`/speckit-tasks` — si la referencia Amelia más profunda
  obliga a ajustar `specs/002-plataforma-superadmin/`.
- `/speckit-implement` — para construir la 002 una vez validada (Setup + Foundational + US1 primero).
- `/speckit-specify` — para las siguientes features del clúster (`tenant-settings`,
  `reservas-ciclo-estados-pagos`).
- `/handoff` — al cerrar la sesión, para refrescar este archivo.

## Reglas de cierre de sesión

Antes de cerrar con cambios relevantes: actualizar `PROGRESS.md` (entrada fechada) y este
`HANDOFF.md`; si se completan tareas, marcar `tasks.md`; si se decide arquitectura, añadir
un ADR. No hacer push/merge/borrado de referencia ni cambio de credenciales sin aprobación
explícita del dueño.
