# SaaS Reservas

SaaS multitenant de reservas inspirado en Amelia Premium, rediseñado como producto cloud-native independiente de WordPress.

## Estado Actual

**Implementación completa** (T001–T086, Fases 1–8). El stack está construido, testeado y mergeado en `main`. El siguiente trabajo es productivización y extensiones post-spec (ver HANDOFF.md).

La fuente de verdad de cada capa:

| Qué necesitas                       | Dónde mirarlo                                      |
| ----------------------------------- | -------------------------------------------------- |
| Reanudar trabajo (cualquier agente) | `HANDOFF.md`                                       |
| Mapa del proyecto y ruta            | `PLANNING.md`                                      |
| Historial de progreso               | `PROGRESS.md`                                      |
| Principios no negociables           | `.specify/memory/constitution.md`                  |
| Especificación funcional            | `specs/001-saas-multitenant-booking/spec.md`       |
| Plan técnico y arquitectura         | `specs/001-saas-multitenant-booking/plan.md`       |
| Backlog de tareas                   | `specs/001-saas-multitenant-booking/tasks.md`      |
| Decisiones de arquitectura          | `docs/adr/` (ADR-0001 a ADR-0016)                  |
| Referencia UX de Amelia             | `docs/analysis/amelia-ux-reference.md`             |
| Modelo de datos                     | `specs/001-saas-multitenant-booking/data-model.md` |
| Sistema de diseño UI                | `docs/design-system.md` (ADR-0008)                 |

## Flujo Agnóstico de Agentes

El proyecto está preparado para trabajar con Codex, Claude u otro modelo sin perder contexto entre sesiones.

- Codex usa `AGENTS.md`.
- Claude usa `CLAUDE.md`.
- Ambos deben leer `HANDOFF.md`, `PLANNING.md` y `PROGRESS.md` al inicio de cada sesión.
- Las decisiones arquitectónicas duraderas se registran en `docs/adr/`.
- Antes de cerrar una sesión con cambios relevantes, actualizar `PROGRESS.md` y `HANDOFF.md`.

## Stack

- **Lenguaje:** TypeScript 5.x en toda la base de código.
- **Frontend admin:** Next.js 15 App Router (`apps/admin`).
- **Frontend widget:** Next.js (`apps/booking-widget`).
- **API:** Fastify (`services/api`).
- **Workers:** BullMQ sobre Redis (`services/worker`).
- **Base de datos:** PostgreSQL con Row-Level Security para multitenancy (`packages/persistence`, Drizzle ORM).
- **Caché / coordinación:** Redis (locks, queues, tokens efímeros).
- **Storage:** Object storage compatible S3/GCS.
- **Contratos:** OpenAPI.
- **Paquetes compartidos:** `packages/domain`, `packages/ui`, `packages/tenant-context`, `packages/contracts`, `packages/integrations`.

Decisiones de stack: ADR-0001 (Next.js) · ADR-0002 (Fastify) · ADR-0003 (Drizzle) · ADR-0004 (BullMQ) · ADR-0005 (auth) · ADR-0007 (Docker Compose) · ADR-0008 (design system).

## Admin Console

`apps/admin` corre con un solo `pnpm dev` usando route handlers process-local (`src/server/demo-store.ts`) — no requiere el servidor Fastify. Implementa la cadena de asignación completa:

```
Ubicación → Recurso → Proveedor → Servicio → Reserva → Cliente → Calendario
```

El **Recurso** es el hub de configuración (modelo parcial Amelia, ADR-0016): declara qué ubicaciones lo contienen, qué servicios consumen su capacidad y qué proveedores son elegibles. Una sola fuente de verdad.

Pantallas funcionales: Ubicaciones, Recursos (hub), Servicios, Proveedores, Clientes, Reservas, Calendario.

## Referencia Amelia

`docs/analysis/amelia-ux-reference.md` contiene el barrido completo del admin de Amelia Premium (14+ áreas). Es la referencia para decisiones de UX/producto — no código fuente.

El material pesado de Amelia/Graphify se mantiene localmente en `reference/` y `archive/` (en `.gitignore`). Consultar `reference/README.md` si es necesario reconstruir ese contexto.

## Pendiente Prioritario

Ver `HANDOFF.md` (sección "Next Actions"). El trabajo más urgente post-spec:

1. Migrar la capa canónica `packages/domain`/persistencia al modelo hub de recursos (ADR-0016 detalla los cambios necesarios).
2. Bootstrap de producción: `services/api/src/main.ts` con adaptadores Drizzle reales.
3. Auth de staff para rutas `/v1/admin/*` (hoy dev-only).
4. Adaptadores reales de pago (Stripe), mensajería y calendar sync.
