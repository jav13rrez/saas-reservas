# Handoff

Last updated: 2026-07-01 (feature 004 UI — ciclo de 6 estados + pago manual en Reservas, T012/T013)

> **Qué es este archivo:** el punto de reanudación corto para el siguiente agente
> (estado, próximas acciones, blockers). **No es un diario** — el historial
> cronológico vive en `PROGRESS.md`; el mapa y el modelo operativo en `PLANNING.md`;
> el backlog de features (por área del sidebar) en
> `docs/analysis/menu-walkthrough-gap-analysis.md`.

## Punto de reanudación (2026-07-01 — feature 004 COMPLETA, en worktree sin mergear a `main`)

- **Trabajo hecho en un worktree aislado** (`worktree-agent-a9d0d1c7ce3fc19db`), commiteado ahí,
  **sin push ni PR todavía** — pide confirmación al dueño antes de abrir PR contra `main`
  (regla del proyecto). Revisa el diff de ese worktree antes de fusionar.
- **Feature 004 — `reservas-ciclo-estados-pagos` COMPLETA (T001–T016, todas las fases, US1–US3 + Polish):**
  - Backend (ya estaba, sesión anterior): ciclo de 6 estados, rutas
    `POST /v1/admin/bookings/:id/{approve,reject,complete,no-show}`,
    `GET`/`PUT /v1/admin/bookings/:id/payment`, ADR-0024.
  - **UI (T012/T013, esta sesión):** pantalla Reservas de `apps/admin` (demo+api) pasa de 2 estados
    (`confirmed/cancelled`) a los 6 reales del dominio. `demo-store.ts` usa el `BookingStatus` del
    dominio directamente (nueva dependencia `@saas-reservas/domain` en `apps/admin` — exports son
    `dist/*`, hay que buildear el paquete domain antes de que `next build`/`tsc` de admin resuelvan
    el import); `createBooking` respeta `requiresApproval`; ocupación usa `OCCUPIES_SLOT`
    (pending/approved/completed/no_show); nuevas transiciones validan contra `canTransition` del
    dominio. Nuevo `source/booking-payment.ts` + rutas
    `app/api/bookings/[id]/{approve,reject,complete,no-show,payment}/route.ts`. UI: badges de color
    por token (pending=warning, approved=success, completed=primary+CheckCheck,
    rejected/no_show=danger, canceled=muted), botones de acción por fila solo con transiciones
    válidas, sección de pago manual expandible. `features/calendar/index.tsx` también migrado a
    `OCCUPIES_SLOT`. Detalle completo en `PROGRESS.md` (entrada 2026-07-01).
  - Suite **384 passing, 7 skipped** (376 previos + 8 nuevos en
    `apps/admin/src/server/__tests__/booking-lifecycle.test.ts`). `vitest.config.ts` ahora incluye
    `apps/admin/src/**/*.test.ts` en el proyecto `unit`. VERIFY completo verde (typecheck, lint,
    format:check, test, build de las 3 apps).
  - **No queda nada pendiente de esta feature.**
- **Feature 003 — `tenant-settings` COMPLETA (T001–T025, US1–US3 + Polish):**
  - Superficie de ajustes real sobre el agregado `Tenant` (Perfil, Localización, Políticas, Marca) +
    nuevo campo **`currency`**. Reemplaza el wizard de la ruta `/settings`.
  - **Persistencia (ADR-0023):** columna `currency` en `tenants` (migración `011`), no tabla aparte.
  - **API:** `GET`/`PATCH /v1/admin/settings` (tenant por request, gate admin-role); `updateSettings`
    all-or-nothing con audit por grupo. Moneda **no retroactiva**; servicios nuevos la heredan.
  - **Admin:** seam `source/settings.ts` (demo+api) + handler + pantalla `features/settings`.
  - **Tests:** +20 (unit/integración/e2e). Suite **364 passing, 7 skipped**. Lint/typecheck/Prettier
    limpios; admin `next build` pasa.
  - **Limpieza colateral:** corregidos errores de lint preexistentes (archivos 002) y un fallo de
    build (`LinkOff`→`Link2Off`) que el toolchain de este contenedor destapó.
- **Feature 002 — COMPLETA (T001–T034, US1–US4 + Polish):**
  - **US1:** identidad platform-global + gate `/v1/platform/*` y `/v1/ops/*` + bootstrap operador
    - login/logout + `apps/platform` (login + dashboard). Quickstart S1–S2 validados.
  - **US2:** ciclo de vida de tenant (provision, suspend/reactivate) + UI en `apps/platform`.
    Quickstart S3–S4 validados.
  - **US3:** vista de Operaciones movida de `apps/admin` a `apps/platform`. Quickstart S5 validado.
  - **US4:** vínculo opcional 1-a-1 `staff_accounts.provider_id`:
    - Migración `infra/postgres/010-staff-provider-link.sql` + schema Drizzle.
    - Puerto `StaffAccountStore` extendido; adaptadores in-memory y Drizzle.
    - `StaffLinkError` en `packages/domain` (evita dependencia circular).
    - `GET /v1/admin/staff` + `PATCH /v1/admin/staff/:staffId { providerId }` (200/409/404).
    - `apps/admin` Providers screen: tabla staff con selector + botón Vincular/Desvincular.
    - Next.js handlers `app/api/staff/route.ts` y `app/api/staff/[id]/route.ts`.
    - Quickstart S6 validado (curl in-memory).
  - **Polish:** `TECH_DEBT.md` actualizado; Quickstart S1–S6 completos.
  - Suite: **344 passing, 7 skipped**, 60 archivos.

## Próximas acciones (priorizadas) — PRÓXIMA SESIÓN

> **→ Empieza por aquí:** feature 004 (T012/T013) ya está fusionada en la rama
> `claude/crear-loop-nxnktr` (loop `loops/reservas-ui-ciclo-pagos.md` completado con éxito, VERIFY
> en verde). Falta confirmar con el dueño si se abre PR contra `main` y hacer push. Después,
> siguiente feature con `/speckit-specify`.

1. **Cerrar feature 004:** pedir confirmación al dueño para hacer push de `claude/crear-loop-nxnktr`
   y abrir PR contra `main`.
2. **Siguiente feature** (`/speckit-specify`):
   - **Email worker**: Brevo ADR-0020 listo; dispatcher arma SMS y no cae a email. Necesita
     bootstrap + handler de email en el worker. Ver `TECH_DEBT.md`. (Buen cierre del MVP: ya hay
     transiciones que disparan notificaciones tras 004.)
   - `reservas-gestion-ux` (búsqueda/filtros/bulk en Reservas) · `cupones` · `finanzas-pagos`.

## Blockers / notas de entorno

- **Migraciones 010, 011 y 012 pendientes de aplicar en producción.** Ver `TECH_DEBT.md`.
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
- **Plataforma superadmin (completa):** `specs/002-plataforma-superadmin/` (T001–T034 todos ✅).
- **Tenant settings (completa):** `specs/003-tenant-settings/` (T001–T025 ✅); ADR-0023.
- **Backlog de crecimiento:** `docs/analysis/menu-walkthrough-gap-analysis.md` (índice de features).
- **Investigación Amelia:** `docs/analysis/amelia-*-fine-grained.md` + `amelia-ux-reference.md`.
- **Decisiones:** `docs/adr/0001…0024`. **Constitución:** `.specify/memory/constitution.md`.
- **Arranque de sesión:** `docs/START_PROMPT.md`.

## Suggested skills (próximo agente)

- `/speckit-specify` — para la siguiente feature (`tenant-settings` o `reservas-ciclo-estados-pagos`).
- `/speckit-implement` — una vez especificada la siguiente feature.
- `/handoff` — al cerrar la sesión, para refrescar este archivo.

## Reglas de cierre de sesión

Antes de cerrar con cambios relevantes: actualizar `PROGRESS.md` (entrada fechada) y este
`HANDOFF.md`; si se completan tareas, marcar `tasks.md`; si se decide arquitectura, añadir
un ADR. No hacer push/merge/borrado de referencia ni cambio de credenciales sin aprobación
explícita del dueño.
