# Handoff

Last updated: 2026-06-24

> **Qué es este archivo:** el punto de reanudación corto para el siguiente agente
> (estado, próximas acciones, blockers). **No es un diario** — el historial
> cronológico vive en `PROGRESS.md`; el mapa y el modelo operativo en `PLANNING.md`;
> el backlog de features (por área del sidebar) en
> `docs/analysis/menu-walkthrough-gap-analysis.md`.

## Punto de reanudación (2026-06-24 — sesión CERRADA)

> **▶️ PRÓXIMA SESIÓN: empezar con `/speckit-implement` de la feature 002.** La planificación está
> completa y validada; la referencia Amelia profundizada (Catalog/Finance/Bookings) ya se revisó y
> **NO afecta a la 002** (son superficies de tenant; 002 es la capa de plataforma). No hay nada
> pendiente que bloquee implementar.

- **Rama de trabajo:** `claude/affectionate-wright-0vx6ka` — **VIVA y empujada a `origin`** (no
  fusionada, no borrar). Todo el trabajo está commiteado y firmado ahí. Continuar en esta rama.
- **Spec 001 completa** (T001–T086) fusionada en `main`. Suite verde (~318 tests). Stack local
  validado E2E (Postgres+Redis+API; admin en `demo` y en `api`).
- **Sesiones recientes (2026-06-24):**
  1. **8 decisiones transversales resueltas** → **ADR-0021** (gap-analysis marcado).
  2. **Feature `002-plataforma-superadmin` planificada de punta a punta**:
     `/speckit-specify` + `/speckit-clarify` + `/speckit-plan` + `/speckit-tasks` →
     `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/platform-api.md`,
     `quickstart.md`, `tasks.md` (34 tareas, 7 fases, tests primero, MVP = US1). Arquitectura en
     **ADR-0022** (app separada `apps/platform`, identidad platform-global, gate, bootstrap
     autobloqueante, suspensión, vínculo proveedor↔staff). **Constitución PASS. Aún SIN implementar.**
  3. **Deep-dive Amelia (Cowork) integrado y revisado:** Catalog/Finance/Bookings profundizados;
     gap-analysis actualizado (🆕 candidata `paquetes`; Finanzas corregido a
     Transactions/Invoices/Coupons, **gift-cards descartado**; áreas 5 y 2 enriquecidas). **002 sin
     cambios.** (Otros 11 docs de Amelia siguen en su estado de 2026-06-23; quizá se profundicen tras
     el MVP.)
- **Dirección de producto:** pagos pausados; prioridad = **camino a un MVP desplegable**.

## Próximas acciones (priorizadas) — PRÓXIMA SESIÓN

> **→ Empieza por aquí:** `/speckit-implement` la feature 002 (`specs/002-plataforma-superadmin/`).

1. **`/speckit-implement` la 002**, por incrementos siguiendo `tasks.md`:
   - **MVP primero**: Fase 1 (Setup) → Fase 2 (Foundational) → **Fase 3 (US1: lockdown + login de
     operador)**, validar (quickstart escenarios 1–2), y parar a revisar.
   - Luego US2 (provisión + ciclo de vida de tenant), US3 (Operaciones a `apps/platform` + DS),
     US4 (vínculo proveedor↔staff, **paralelizable**), y Polish.
   - Reflejar el patrón staff-auth (ADR-0017) para la identidad de plataforma; tests primero
     (exigidos por la constitución). Marcar tareas en `tasks.md` al completarlas.
2. **Tras 002** (clúster MVP): `tenant-settings`, `reservas-ciclo-estados-pagos`, worker de
   notificaciones email (Brevo wired; falta bootstrap + dispatcher email). Detalle en el gap-analysis.
3. **Backlog enriquecido por el deep-dive** (post-MVP): nueva feature `paquetes`; `finanzas-pagos`
   ahora incluye Invoices; `cupones` con modal ya especificado.

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

- **Primero (esta vez): `/speckit-implement`** la feature 002 (`specs/002-plataforma-superadmin/`),
  empezando por Setup + Foundational + US1 (MVP). Tests primero; marcar `tasks.md` al avanzar.
- `/speckit-specify` — para las siguientes features del clúster (`tenant-settings`,
  `reservas-ciclo-estados-pagos`) tras la 002.
- `/handoff` — al cerrar la sesión, para refrescar este archivo.

## Reglas de cierre de sesión

Antes de cerrar con cambios relevantes: actualizar `PROGRESS.md` (entrada fechada) y este
`HANDOFF.md`; si se completan tareas, marcar `tasks.md`; si se decide arquitectura, añadir
un ADR. No hacer push/merge/borrado de referencia ni cambio de credenciales sin aprobación
explícita del dueño.
