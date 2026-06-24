# Handoff

Last updated: 2026-06-24

> **Qué es este archivo:** el punto de reanudación corto para el siguiente agente
> (estado, próximas acciones, blockers). **No es un diario** — el historial
> cronológico vive en `PROGRESS.md`; el mapa y el modelo operativo en `PLANNING.md`;
> el backlog de features (por área del sidebar) en
> `docs/analysis/menu-walkthrough-gap-analysis.md`.

## Punto de reanudación (2026-06-24 — feature 002 US1 implementada)

> **▶️ PRÓXIMA SESIÓN: continuar la feature 002 con `/speckit-implement` desde US2 (Fase 4).** El MVP
> (Fases 1–3, US1) está **implementado, probado y validado**; **detenido en US1** por decisión del
> dueño. No avanzar a US2/US3/US4 sin retomarlo explícitamente.

- **Rama de trabajo:** `claude/affectionate-wright-0vx6ka` — **VIVA y empujada a `origin`** (no
  fusionada, no borrar). Continuar en esta rama.
- **Spec 001 completa** (T001–T086) fusionada en `main`. Suite verde.
- **Feature 002 — US1 (MVP) COMPLETADO (Fases 1–3, T001–T016):**
  - Identidad platform-global (`platform_operators`, sin RLS) + `PlatformAuthService` (scrypt,
    cookie `platform_session`, sesiones in-memory v1) + gate sobre `/v1/platform/*` y `/v1/ops/*`
    (401 sin sesión, 403 con `staff_session`). Bootstrap del primer operador **gated por
    `PLATFORM_BOOTSTRAP_SECRET` y self-locking**. Nueva app `apps/platform` (login + dashboard,
    DS-aligned, `next build` verde).
  - Tests: 2 unit (bootstrap pura + password/uniform), 1 e2e (escenarios 1–2). Suite total verde
    (unit 112 / e2e 40 / contract 58); typecheck + lint limpios. Quickstart **escenarios 1 y 2
    validados en terminal** (curl contra API in-memory). `tasks.md` T001–T016 marcados.
  - **Cierra el agujero de seguridad** de `/v1/ops/*` y de la provisión de tenants (ahora gated).
  - Arquitectura en **ADR-0022**. Deuda nueva en `TECH_DEBT.md` (sesiones in-memory, sin rate
    limiting, **audit platform-global best-effort**).
- **Pendiente de la 002 (NO hecho, próximos incrementos):** US2 (Fase 4: `PATCH` ciclo de vida de
  tenant + suspensión en el resolver + UI de provisión), US3 (Fase 5: mover Operaciones de
  `apps/admin` a `apps/platform` + realinear al DS), US4 (Fase 6: vínculo proveedor↔staff,
  paralelizable), Polish (Fase 7).
- **Dirección de producto:** pagos pausados; prioridad = **camino a un MVP desplegable**.

## Próximas acciones (priorizadas) — PRÓXIMA SESIÓN

> **→ Empieza por aquí:** `/speckit-implement` la feature 002 desde **US2 (Fase 4)**.

1. **Continuar la 002** siguiendo `tasks.md`, tests primero (constitución):
   - **US2 (Fase 4, T017–T022)**: `PATCH /v1/platform/tenants/:id` (active/suspended, auditado),
     suspensión decidida en `tenant-resolver.ts` (bloquea login staff + checkout público, preserva
     reservas confirmadas), UI de provisión/ciclo de vida en `apps/platform`. Validar quickstart 3–4.
   - **US3 (Fase 5, T023–T026)**: mover Operaciones a `apps/platform` (lectura cross-tenant por el
     path global, sin ensanchar RLS) + realinear al DS; quitarla de `apps/admin`. Validar quickstart 5.
   - **US4 (Fase 6, T027–T031, paralelizable)**: vínculo opcional 1-a-1 `staff_accounts.provider_id`.
   - **Polish (Fase 7)**.
2. **Tras 002** (clúster MVP): `tenant-settings`, `reservas-ciclo-estados-pagos`, worker de
   notificaciones email (Brevo wired; falta bootstrap + dispatcher email). Detalle en el gap-analysis.
3. **Backlog enriquecido por el deep-dive** (post-MVP): nueva feature `paquetes`; `finanzas-pagos`
   ahora incluye Invoices; `cupones` con modal ya especificado.

## Blockers / notas de entorno

- **Email worker** sin bootstrap (Brevo ADR-0020 listo); dispatcher arma SMS y no cae a
  email. Ver `TECH_DEBT.md`.
- **Seguridad:** el gate de plataforma (US1) ya protege `/v1/platform/*` y `/v1/ops/*` **a nivel de
  API** cuando `platformAuth` está cableado (lo está en ambos bootstraps de `main.ts`). Aún
  **pendiente US3**: la vista `/operations` sigue viviendo en `apps/admin` (moverla a `apps/platform`).
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
- **Feature en curso (US1 implementada; US2–US4 pendientes):** `specs/002-plataforma-superadmin/`.
- **Arranque de sesión:** `docs/START_PROMPT.md`.

## Suggested skills (próximo agente)

- **Primero (esta vez): `/speckit-implement`** la feature 002 (`specs/002-plataforma-superadmin/`)
  **desde US2 (Fase 4)** — US1 (MVP) ya está implementada y validada. Tests primero; marcar
  `tasks.md` al avanzar.
- `/speckit-specify` — para las siguientes features del clúster (`tenant-settings`,
  `reservas-ciclo-estados-pagos`) tras la 002.
- `/handoff` — al cerrar la sesión, para refrescar este archivo.

## Reglas de cierre de sesión

Antes de cerrar con cambios relevantes: actualizar `PROGRESS.md` (entrada fechada) y este
`HANDOFF.md`; si se completan tareas, marcar `tasks.md`; si se decide arquitectura, añadir
un ADR. No hacer push/merge/borrado de referencia ni cambio de credenciales sin aprobación
explícita del dueño.
