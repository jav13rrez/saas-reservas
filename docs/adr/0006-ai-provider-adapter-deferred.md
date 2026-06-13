# ADR-0006: Reserve AIProviderAdapter Interface, Defer Implementation

**Date**: 2026-06-11
**Status**: accepted
**Deciders**: Project owner + agent

## Context

Future product ideas (assisted scheduling, message drafting, summarization) may need LLM providers. The constitution requires all external providers to sit behind adapter interfaces with tenant/provider-scoped encrypted credentials. Committing to a provider now would be speculative.

## Decision

Do not implement any AI features in v1. Reserve an `AIProviderAdapter` interface in `packages/integrations` alongside payment/calendar/messaging adapters when that package is created, so AI providers later follow the same adapter + encrypted-credential pattern. No bounded context, tables, or jobs for AI yet.

## Alternatives Considered

- Build the AI bounded context now: violates YAGNI; no feature spec exists, and it would distract from booking correctness foundations.
- No reservation at all: risks AI calls being bolted on outside the adapter discipline later.

## Consequences

- Zero v1 cost; the integration pattern is pre-decided so future AI work cannot bypass credential isolation.
- Follow-up: a dedicated ADR (provider choice, data privacy, tenant opt-in) before the first AI feature ships.
