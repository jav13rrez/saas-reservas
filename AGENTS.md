## Cross-Agent Continuity

This project is designed to work across Codex and Claude without losing context.

A ready-to-paste startup prompt lives in `docs/START_PROMPT.md`.

Read these files in order at the start of a new session:

1. `HANDOFF.md` — current resume point and next actions.
2. `PLANNING.md` — project map, source-of-truth hierarchy, operating model.
3. `PROGRESS.md` — timeline of completed work and current state.
4. `.specify/memory/constitution.md` — non-negotiable architecture principles.
5. `specs/001-saas-multitenant-booking/plan.md` — current technical plan.
6. `specs/001-saas-multitenant-booking/tasks.md` — implementation backlog.
7. `docs/analysis/menu-walkthrough-gap-analysis.md` — post-spec growth feature index.

Before designing UI or a new feature, also read the relevant
`docs/analysis/amelia-*-fine-grained.md` (full Amelia reference, 13 areas).

Before ending a meaningful session, update `PROGRESS.md` and `HANDOFF.md`. If tasks were completed, update `tasks.md`. If a major architecture decision was made, record it under `docs/adr/`.

All UI work follows `docs/design-system.md` (ADR-0008): tokens from `packages/ui`, icons from `lucide-react` only, and no emojis in product UI or user-facing strings.

Do not push, publish, merge, delete reference material, or change credentials without explicit user approval.

## Current Implementation State

All spec tasks T001–T086 are complete. There are no pending spec tasks. Current work is post-spec productionization and feature extensions. Read `HANDOFF.md` for the prioritized next-action list.

## Admin Console Architecture

`apps/admin` runs with a single `pnpm dev` using process-local Next.js route handlers backed by `apps/admin/src/server/demo-store.ts`. This store implements the full assignment chain:

```
Ubicación → Recurso → Proveedor → Servicio → Reserva → Cliente → Calendario
```

**Resource hub model** (ADR-0016): the `AdminResource` entity is the configuration hub — it declares `locationIds[]`, `serviceIds[]`, `employeeIds[]` (empty = "any"). The old `service.resourceId` and `provider.resourceIds` have been removed. The canonical domain/persistence layer (`packages/domain`, Drizzle) has NOT yet been migrated to the hub model — that is the top priority follow-up task (see HANDOFF.md and ADR-0016 "Consequences").

## Amelia UX Reference

`docs/analysis/amelia-ux-reference.md` contains the full sweep of the Amelia Premium admin console (14+ areas). Read it before designing any new UI or product feature. Key open decisions from the sweep are in the "Decisiones pendientes" section of that file and in `HANDOFF.md`.

## graphify

This project keeps archived Amelia reference knowledge graphs under reference/graphify/.
The most useful frozen graph for the SaaS design is reference/graphify/saas-core/.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:

- For Amelia-inspired architecture questions, prefer reference/graphify/saas-core/GRAPH_REPORT.md and reference/graphify/saas-core/graph.html before the larger archived graphs.
- reference/graphify/backend/ is useful when backend WordPress/PHP persistence details matter.
- archive/graphify-full/ is a noisy full-corpus snapshot; use it only when a broad Amelia feature is missing from the focused graphs.
- Do not treat reference/ or archive/ as source code for the new SaaS. They are frozen research inputs.
- After new SaaS source code exists, build fresh Graphify outputs for that codebase rather than updating the Amelia reference graphs.

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/005-worker-email/plan.md

<!-- SPECKIT END -->
