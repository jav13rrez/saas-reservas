# Handoff

Last updated: 2026-06-23

> **Qué es este archivo:** el punto de reanudación corto para el siguiente agente
> (estado, próximas acciones, blockers). **No es un diario** — el historial
> cronológico vive en `PROGRESS.md`; el mapa y el modelo operativo en `PLANNING.md`;
> el backlog de features (por área del sidebar) en
> `docs/analysis/menu-walkthrough-gap-analysis.md`.

## Punto de reanudación (2026-06-23)

- **Rama de trabajo:** `claude/nice-brahmagupta-ltqera` (sincronizada con `main`).
- **Spec 001 completa** (T001–T086) y todo el trabajo post-spec fusionado en `main`.
  Suite verde (~318 tests). Stack local validado E2E (Postgres+Redis+API; admin en
  `demo` y en `api`).
- **Esta sesión:** recorrido del panel admin **área por área (13/13)** volcado a
  `docs/analysis/menu-walkthrough-gap-analysis.md` (estado actual ↔ referencia Amelia
  ↔ huecos ↔ candidatos a feature) + reorganización de los docs de continuidad.
  Sesión previa: barrido **Amelia fine-grained** (13 docs, 160+ tablas).
- **Dirección de producto:** pagos pausados; prioridad = **camino a un MVP
  desplegable** (deploy en host/dominio, widget público, notificaciones email mínimas).

## Próximas acciones (priorizadas)

Detalle en el gap-analysis (índice de features) y su sección "Síntesis".

1. **Cerrar las 8 decisiones transversales** del recorrido antes de abrir specs
   (categoría-entidad, online/virtual, group booking, dónde viven políticas+moneda,
   IA Facturación-vs-Finanzas, IA de las 4 áreas Amelia sin menú, **Auth/superadmin**,
   ciclo de estados de reserva).
2. **Clúster crítico MVP** → convertir en features Spec-Kit (`/speckit-specify`):
   - `tenant-settings` — políticas de tiempo, sender email por tenant, activar
     pasarela, perfil del tenant. **Fundacional.**
   - `reservas-ciclo-estados-pagos` — de estado binario a 6 estados + pagos manuales.
   - `plataforma-superadmin` — auth de plataforma; hoy `/operations` expone **todos los
     tenants sin protección** (seguridad + objetivo del dueño).
   - Worker de notificaciones email (Brevo wired; falta bootstrap + dispatcher email).
3. **Objetivo del dueño (Auth):** login de operador + cuenta tenant/admin + cuenta
   superadmin de plataforma; credenciales durables fuera de git; registrar en un ADR.

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
- **Decisiones:** `docs/adr/0001…0020`. **Constitución:** `.specify/memory/constitution.md`.
- **Arranque de sesión:** `docs/START_PROMPT.md`.

## Reglas de cierre de sesión

Antes de cerrar con cambios relevantes: actualizar `PROGRESS.md` (entrada fechada) y este
`HANDOFF.md`; si se completan tareas, marcar `tasks.md`; si se decide arquitectura, añadir
un ADR. No hacer push/merge/borrado de referencia ni cambio de credenciales sin aprobación
explícita del dueño.
