# ADR-0003: Drizzle ORM With SQL Migrations

**Date**: 2026-06-11
**Status**: accepted
**Deciders**: Project owner + agent

## Context

Tenancy uses a shared PostgreSQL database with Row-Level Security. Every tenant-owned query must run inside a transaction that first executes `SET LOCAL app.current_tenant_id = ...`. RLS policies, `tenant_id` indexes, and tenancy conventions live in versioned SQL (`infra/postgres/`). The data layer must not fight raw SQL.

## Decision

Use Drizzle ORM in `packages/persistence` with SQL migrations. Schema is declared in TypeScript for end-to-end types; migrations are generated as plain SQL and reviewed by hand, so RLS policies and tenancy SQL stay first-class. All tenant-scoped repositories accept a transaction handle that has tenant context already set.

## Alternatives Considered

- Prisma: best CRUD DX, but per-request `SET LOCAL` requires wrapping everything in interactive transactions, and the query engine adds weight; RLS workflows are awkward.
- Kysely: excellent typed SQL, but no schema/migration system — more manual glue for similar benefit.
- SQL-first (raw SQL only): maximal control, but loses the typed contracts that justify the TypeScript monorepo.

## Consequences

- RLS, `SET LOCAL`, and custom indexes are natural, not workarounds.
- Typed schema shared with domain code and tests.
- Negative: Drizzle is younger than Prisma; some advanced features need raw SQL fragments (acceptable, even desired here).
- Follow-up: define the tenant-scoped transaction helper in `packages/tenant-context` (T008).
