# Claude Project Instructions

This project is agent-agnostic. Claude and Codex must follow the same durable workflow.

## Session Start

A ready-to-paste startup prompt lives in `docs/START_PROMPT.md`.

Read these files in order before making changes:

1. `HANDOFF.md`
2. `PLANNING.md`
3. `PROGRESS.md`
4. `.specify/memory/constitution.md`
5. `specs/001-saas-multitenant-booking/plan.md`
6. `specs/001-saas-multitenant-booking/tasks.md`
7. `docs/analysis/menu-walkthrough-gap-analysis.md` (índice de features de crecimiento post-spec)

Before designing UI or a new feature, also read the relevant
`docs/analysis/amelia-*-fine-grained.md` (full Amelia reference, 13 areas).

## Core Rule

Spec Kit is the product planning source of truth. `PLANNING.md`, `PROGRESS.md`, and `HANDOFF.md` are the cross-agent continuity layer.

## Operating Rules

- Keep implementation aligned with `.specify/memory/constitution.md`.
- Update `PROGRESS.md` and `HANDOFF.md` before ending a meaningful session.
- Update `tasks.md` when tasks are completed.
- Record major architecture decisions under `docs/adr/`.
- All UI work follows `docs/design-system.md` (ADR-0008): tokens from `packages/ui`, icons from `lucide-react` only, and no emojis in product UI or user-facing strings.
- Do not treat `reference/` or `archive/` as source code.
- Do not commit Amelia Premium source, Graphify heavy outputs, secrets, or local agent caches.
- Ask before pushing, publishing, merging, deleting reference material, or changing credentials.

## Graphify And Reference Material

Amelia/Graphify material is local reference only:

- `reference/graphify/saas-core/` is the preferred graph for architecture questions.
- `reference/graphify/backend/` is useful for backend/persistence details.
- `archive/graphify-full/` is noisy and should be used only when the focused graphs miss something.

## Current Implementation Pointer

All spec tasks T001–T086 (Phases 1–8, User Stories 1–5) are **complete**. Stack decisions live in `docs/adr/` (ADR-0001 through ADR-0016). There are no pending spec tasks.

Current work is post-spec: productionization, real adapter wiring, and feature extensions. The prioritized list lives in `PLANNING.md` ("Immediate Route") and `HANDOFF.md` ("Next Actions").

Key post-spec context for the next agent:

- **Admin console architecture**: `apps/admin` runs standalone via process-local Next.js route handlers (`src/server/demo-store.ts`). It implements the full chain: Ubicación → Recurso → Proveedor → Servicio → Reserva → Cliente → Calendario.
- **Resource hub model** (ADR-0016): the Resource declares `locationIds[]`, `serviceIds[]`, `employeeIds[]`. The old `service.resourceId` and `provider.resourceIds` are gone from the admin store. The canonical domain/persistence layer (`packages/domain`, Drizzle) still needs this migration — it is the top priority follow-up.
- **Amelia UX reference**: `docs/analysis/amelia-ux-reference.md` is the permanent record of all Amelia admin areas. Read it before designing any new UI or product feature to avoid reinventing what Amelia solved.
- **Pending decisions from the Amelia sweep**: quantity partition (shared/per-service/per-location), group booking, category-as-entity, provider Work Hours/Days Off UI, online/virtual locations. All registered in `amelia-ux-reference.md` and `HANDOFF.md`.
