# ADR-0007: Docker Compose For Local Development, Cloud Target Deferred

**Date**: 2026-06-11
**Status**: accepted
**Deciders**: Project owner + agent

## Context

Development needs PostgreSQL (with RLS), Redis, and S3-compatible object storage locally, identical for every agent/human session. The production cloud target (and managed-service choices) is not yet decided and should not block implementation of T001–T014.

## Decision

Use Docker Compose under `infra/` for local development: PostgreSQL 16+, Redis 7+, and MinIO as the S3-compatible store. Apps and services run on the host via pnpm for fast iteration; only stateful dependencies run in containers. Migrations and seed scripts run against the compose services.

## Alternatives Considered

- Full devcontainer (everything in Docker): reproducible but slower iteration for Node workspaces.
- Cloud dev environments (Supabase/Neon/Upstash for dev): convenient, but local RLS and integration tests must not require network access or shared state.
- Deciding production now: premature; tenant routing (reverse proxy, custom domains) constraints should inform that choice.

## Consequences

- Integration tests (RLS, locks, queues) run against real Postgres/Redis locally and in CI via the same compose file.
- Negative: production topology remains open; a follow-up ADR must cover cloud target, reverse proxy/tenant routing, and managed Postgres/Redis/storage before first deploy.
