# Prompt de Inicio de Sesión

Pega este prompt al arrancar cualquier sesión nueva (Claude, Codex u otro modelo).
Está diseñado para que el agente se oriente solo a partir de los documentos de
flujo del repo, sin asumir herramientas de ningún proveedor concreto.

Si prefieres que el agente arranque a programar directamente, cambia el último
párrafo por: _"…dame el resumen y procede con la próxima acción prioritaria"_.

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
  - docs/adr/ (ADR-0001 a ADR-0024) — el porqué de cada decisión de arquitectura.
    El modelo de recursos vigente es el HUB de ADR-0016; la auth de staff es
    ADR-0017; la integración admin↔API persistente es ADR-0018 (incl. el ruteo de
    tenant por X-Forwarded-Host); el gateway real de Stripe es ADR-0019 (incl.
    payment-method + webhook firmado); el adaptador de email Brevo es ADR-0020.
    Las 8 decisiones transversales están resueltas en ADR-0021; la auth de
    plataforma/superadmin en ADR-0022 (feature 002); los tenant-settings persisten
    en el registro `tenants` (ADR-0023, feature 003); el ciclo de estados de reserva
    de 6 estados + pagos manuales en ADR-0024 (feature 004).

Estado actual (a fecha de este prompt): las tareas de spec T001–T086 están
COMPLETAS y TODO el trabajo post-spec está fusionado en `main`. Features de
crecimiento completas: **002 plataforma-superadmin** (auth de plataforma + gate de
/v1/platform/* y /v1/ops/* + ciclo de vida de tenant + Operaciones en apps/platform;
ADR-0022), **003 tenant-settings** (superficie de ajustes real sobre el tenant:
perfil, localización, políticas, marca + moneda; ADR-0023), y **004
reservas-ciclo-estados-pagos — BACKEND** (6 estados de reserva con
completed/no-show, default configurable por `requiresApproval`, y pagos manuales;
ADR-0024). Base ya existente: HUB de recursos (ADR-0016), auth de staff (ADR-0017),
integración admin↔API en modo `api` validada en vivo (ADR-0018), Stripe real
(ADR-0019) y email Brevo (ADR-0020), ambos detrás de su puerto y seleccionados por
env (los fakes siguen de default). **Hay CI** (GitHub Actions) que corre
typecheck/lint/format/test + build en cada PR. La suite está en ~376 tests verdes.

ESTA SESIÓN ARRANCA AQUÍ — próxima acción prioritaria (ver HANDOFF "Próximas
acciones"): **terminar la UI de la feature 004** en la pantalla Reservas (T012/T013):
acciones de estado por fila (Aprobar/Rechazar/Completar/No-show) + sección de pago
manual, vía el seam (demo+api). El backend (rutas `POST /v1/admin/bookings/:id/
{approve,reject,complete,no-show}`, `GET`/`PUT .../payment`, dominio y persistencia)
está completo y probado; falta la UI, que incluye extender el demo-store de 2 estados
(`confirmed/cancelled`) a los 6 del dominio. Después, candidata fuerte: el **email
worker** (cierra notificaciones del MVP, que las transiciones de 004 ya disparan).

Contexto clave (léelo antes de proponer):
  - Para un **recorrido visual del menú**, `apps/admin` en modo demo
    (ADMIN_DATA_MODE por defecto, `pnpm --filter @saas-reservas/admin dev`, Node 22)
    trae la cadena completa sembrada en memoria. Para datos reales/persistentes y
    auth, usar modo `api` contra el stack (Postgres + Redis + API), ya validado.
  - **Auth: el gap principal está RESUELTO** (feature 002, ADR-0022): existe identidad
    de plataforma/superadmin, /v1/platform/* y /v1/ops/* están gateados, y la provisión
    de tenants ya requiere sesión de operador. La pantalla de operaciones vive en
    `apps/platform`. (Sigue pendiente, menor: migrar el portal de staff del header
    `x-provider-id` a sesión — ver TECH_DEBT.)
  - Antes de diseñar UI nueva, lee docs/analysis/amelia-*-fine-grained.md del área
    (para Reservas: docs/analysis/amelia-bookings-fine-grained.md).
  - **Migraciones 010, 011 y 012 pendientes de aplicar en producción** (TECH_DEBT).


Contexto de operación (importante): el dueño es **principiante** (viene de
Supabase+Vercel, en onboarding). Trabaja en WSL2 (Ubuntu). REGLAS DE TRATO:
explica paso a paso, en español, **un comando cada vez**; **NUNCA le pidas pegar
bloques grandes multilínea en su terminal** (se corrompen) — usa comandos de una
sola línea o un archivo + `bash archivo.sh`; no des por hecho herramientas (p.ej.
`jq` puede faltar). No te adelantes: confirma antes de profundizar.

Estado de operación: el stack local (Postgres + Redis vía Docker en WSL2 + API
persistente) está montado y validado de punta a punta, incluido el modo `api` del
admin (un tenant real, login de staff por cookie, una reserva real cerrada). El
admin corre con `pnpm --filter @saas-reservas/admin dev` (Node 22), en demo
(memoria) o en modo `api` (ADMIN_DATA_MODE=api).

Dirección de producto: la prioridad es el **camino a un MVP desplegable** (desplegar
en dominio/host real, widget público de reserva, notificaciones email mínimas vía
worker). Las features 002–004 han cerrado el grueso del modelo de negocio (auth de
plataforma, ajustes del tenant, ciclo de estados + pagos manuales). La deuda pre-VPS
vive en TECH_DEBT.md (raíz): léela antes de planificar despliegue — incluye las
migraciones 010/011/012 pendientes de aplicar y la falta de un migration runner.
Lado operador (en su máquina, no en el repo): Stripe CLI instalado + logueado y un
`whsec_…` guardado en su `.env` local — preparado pero sin usar hasta que haya
despliegue. Guías de apoyo: docs/operations/SETUP.md (checklist) y .env.example.

Reglas de operación (de CLAUDE.md / AGENTS.md):
  - Spec Kit es la fuente de verdad de producto. PLANNING/PROGRESS/HANDOFF son la
    capa de continuidad entre agentes: actualízalos antes de cerrar una sesión con
    cambios relevantes; si completas tareas, actualiza tasks.md; si tomas una
    decisión de arquitectura, registra un ADR en docs/adr/.
  - Toda UI sigue docs/design-system.md (ADR-0008): tokens de packages/ui, iconos
    solo de lucide-react, sin emojis en UI ni en strings de usuario.
  - No trates reference/ ni archive/ como código fuente (son research local).
  - **CI + flujo de PR:** hay GitHub Actions (.github/workflows/ci.yml) que corre
    typecheck/lint/format:check/test + build en cada PR y push a main. Valida lo mismo
    en local (`pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`) antes de
    abrir PR. El trabajo se integra a `main` por PR (rama desde main → PR → CI verde →
    merge), nunca commiteando features directo en main. `.prettierignore` excluye
    `docs/`, `specs/`, `reference/`, `archive/`.
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
