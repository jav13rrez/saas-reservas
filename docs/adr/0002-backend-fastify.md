# ADR-0002: Fastify As Backend API Framework

**Date**: 2026-06-11
**Status**: accepted
**Deciders**: Project owner + agent

## Context

The constitution mandates "Domain Engine Before Delivery Channels": booking, availability, pricing, and policy logic must live in framework-agnostic modules. The API layer must set tenant context (`app.current_tenant_id`) per request before any tenant-owned query, which requires precise control over the request lifecycle.

## Decision

Use Fastify for `services/api`. Routes/controllers stay thin: they resolve tenant context, validate input, call application services from `packages/domain` / `services/api/src/application`, and serialize responses. Fastify plugins handle tenant resolution, auth, and request-scoped database context.

## Alternatives Considered

- NestJS: richer structure (DI, modules, guards) useful for large teams, but heavier framework coupling conflicts with the domain-first principle and adds ceremony for the same outcome.
- Express: ubiquitous but slower, weaker TypeScript story, and no first-class schema validation.
- Hono: very fast and portable, but a younger ecosystem for the plugin surface this project needs (multipart, websockets, observability).

## Consequences

- Explicit, auditable request lifecycle: host → tenant resolver → auth → RLS context → handler.
- JSON Schema validation per route integrates with OpenAPI generation (`packages/contracts`).
- Negative: less built-in architecture than NestJS; module conventions must be enforced by review and lint rules.
