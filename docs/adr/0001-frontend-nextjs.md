# ADR-0001: Next.js App Router As Frontend Shell

**Date**: 2026-06-11
**Status**: accepted
**Deciders**: Project owner + agent

## Context

The plan requires multiple web surfaces (admin, booking widget, staff portal, customer portal) sharing TypeScript contracts with the backend, with per-tenant branding, subdomain/custom-domain resolution, and SSR-friendly public pages for the booking widget.

## Decision

Use Next.js (App Router) for all apps under `apps/`. Apps consume `packages/contracts`, `packages/domain` types, and `packages/ui`; they never contain domain logic.

## Alternatives Considered

- Remix/React Router: solid SSR model, but smaller ecosystem for multi-app monorepos and less team familiarity.
- SPA (Vite + React): simplest, but public booking pages need SSR/SEO and tenant-domain-aware rendering.
- SvelteKit: attractive DX, but breaks the single-language/single-ecosystem TypeScript+React assumption in the plan.

## Consequences

- Shared React/TypeScript skill set across all four apps.
- Middleware/edge layer can pre-resolve tenant from host, with backend re-validation as required by the constitution.
- Negative: Next.js version churn requires periodic upgrade work.
- Follow-up: decide hosting model (self-hosted Node vs platform) in the deployment ADR follow-up.
