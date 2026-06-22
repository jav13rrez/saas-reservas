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
  - docs/adr/ (ADR-0001 a ADR-0020) — el porqué de cada decisión de arquitectura.
    El modelo de recursos vigente es el HUB de ADR-0016; la auth de staff es
    ADR-0017; la integración admin↔API persistente es ADR-0018 (incl. el ruteo de
    tenant por X-Forwarded-Host); el gateway real de Stripe es ADR-0019 (incl.
    payment-method + webhook firmado); el adaptador de email Brevo es ADR-0020.

Estado actual (a fecha de este prompt): las tareas de spec T001–T086 están
COMPLETAS y TODO el trabajo post-spec hasta aquí está fusionado en `main`. Hecho:
modelo HUB de recursos (ADR-0016), auth de staff para /v1/admin/* (ADR-0017),
bootstrap de servidor (main.ts: Drizzle/Redis o in-memory), integración de
apps/admin contra la API persistente en modo `api` **validada en vivo** y con el
bug de ruteo `Host`/undici corregido vía X-Forwarded-Host (ADR-0018), agenda por
proveedor, Stripe real con payment-method + webhook firmado platform-level
(ADR-0019, seleccionado por STRIPE_SECRET_KEY; el fake sigue de default), y el
adaptador de **email Brevo** detrás del puerto MessageProvider (ADR-0020,
seleccionado por BREVO_API_KEY; el fake sigue de default). La suite está en 318
tests verdes.

ESTA SESIÓN ARRANCA AQUÍ (objetivo del dueño): **correr el SaaS en local y
recorrer el panel admin ÁREA POR ÁREA desde el menú** (Dashboard, Calendario,
Reservas, Servicios, Recursos, Ubicaciones, Proveedores, Clientes, Ajustes…) para
analizar qué hace cada funcionalidad y qué falta. En paralelo, el dueño quiere
**resolver la autenticación de operador y dejar establecidas y recordadas dos
cuentas**: (a) una **cuenta de tenant** (negocio) con su admin, y (b) una **cuenta
superadmin / de plataforma**.

Contexto clave para ese objetivo (léelo antes de proponer):
  - Para un **recorrido visual rápido del menú**, `apps/admin` en modo demo
    (ADMIN_DATA_MODE por defecto, `pnpm --filter @saas-reservas/admin dev`, Node 22)
    trae la cadena completa sembrada en memoria — es lo más cómodo para ver la UI.
    Para datos reales/persistentes y auth, usar modo `api` contra el stack
    (Postgres + Redis + API), ya validado en vivo.
  - **Auth hoy (gap a resolver):** existe auth de staff a nivel API (ADR-0017:
    `staff_accounts` por tenant, cookie de sesión scrypt), pero el admin en modo
    `api` usa UNA credencial de servicio por env (ADMIN_STAFF_EMAIL/PASSWORD), SIN
    pantalla de login por operador; y el modo demo no tiene auth. Provisionar
    tenants (`POST /v1/platform/tenants`) está ABIERTO: **no hay aún auth de
    plataforma/superadmin**. Diseñar/implementar: una pantalla de login real para
    el operador y el concepto de cuenta superadmin de plataforma; registrar las
    credenciales de forma durable (seed/doc local fuera de git, nunca secretos en
    el repo). Si tomas decisiones de auth, regístralas en un ADR.
  - Antes de diseñar UI nueva, lee docs/analysis/amelia-ux-reference.md.


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

Dirección actual (acordada al cerrar la sesión previa): se **pausó profundizar en
pagos**; la prioridad de producto es el **camino a un MVP desplegable** (desplegar
en dominio/host real, widget público de reserva, notificaciones email mínimas vía
worker). El objetivo inmediato del dueño (recorrer el menú + resolver Auth y las
cuentas tenant/superadmin) encaja en ese rumbo. La deuda pre-VPS vive en
TECH_DEBT.md (raíz): léela antes de planificar despliegue. Lado operador (en su
máquina, no en el repo): Stripe CLI instalado + logueado y un `whsec_…` guardado
en su `.env` local — preparado pero sin usar hasta que haya despliegue.
Guías de apoyo: docs/operations/SETUP.md (checklist de operador) y .env.example.

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
