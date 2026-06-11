# SaaS Reservas

SaaS multitenant de reservas inspirado en el comportamiento de Amelia Premium, pero redisenado como producto cloud-native independiente de WordPress.

## Estado Actual

El repositorio contiene la base de especificacion y planificacion generada con Spec Kit. Todavia no contiene la implementacion del producto.

La fuente de verdad actual esta en:

- `.specify/memory/constitution.md`: principios y restricciones arquitectonicas.
- `specs/001-saas-multitenant-booking/spec.md`: especificacion funcional.
- `specs/001-saas-multitenant-booking/plan.md`: plan tecnico y estructura objetivo.
- `specs/001-saas-multitenant-booking/tasks.md`: tareas iniciales de implementacion.

## Stack Previsto

- TypeScript 5.x.
- Frontend: Next.js o shell equivalente.
- Backend API: Fastify/NestJS o equivalente.
- PostgreSQL con Row-Level Security para multitenancy.
- Redis para locks, colas, cache y tokens efimeros.
- Object storage compatible con S3/GCS.
- OpenAPI para contratos.
- Workers asincronos para notificaciones, webhooks, calendario, pagos y jobs recurrentes.

## Material De Referencia

El analisis de Amelia y Graphify se mantiene localmente en `reference/` y `archive/`, pero no se sube al repositorio. Es material pesado y solo sirve como input historico para decisiones de arquitectura.

Si necesitas reconstruir contexto, consulta:

- `GRAPH_VARIANTS.md`
- `reference/README.md`
- `archive/README.md`

## Siguiente Paso

Cerrar decisiones tecnicas concretas y empezar por `T001` en `specs/001-saas-multitenant-booking/tasks.md`.
