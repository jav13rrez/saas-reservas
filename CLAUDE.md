# Claude Project Instructions

This project is agent-agnostic. Claude and Codex must follow the same durable workflow.

## Session Start

Read these files in order before making changes:

1. `HANDOFF.md`
2. `PLANNING.md`
3. `PROGRESS.md`
4. `.specify/memory/constitution.md`
5. `specs/001-saas-multitenant-booking/plan.md`
6. `specs/001-saas-multitenant-booking/tasks.md`

## Core Rule

Spec Kit is the product planning source of truth. `PLANNING.md`, `PROGRESS.md`, and `HANDOFF.md` are the cross-agent continuity layer.

## Operating Rules

- Keep implementation aligned with `.specify/memory/constitution.md`.
- Update `PROGRESS.md` and `HANDOFF.md` before ending a meaningful session.
- Update `tasks.md` when tasks are completed.
- Record major architecture decisions under `docs/adr/`.
- Do not treat `reference/` or `archive/` as source code.
- Do not commit Amelia Premium source, Graphify heavy outputs, secrets, or local agent caches.
- Ask before pushing, publishing, merging, deleting reference material, or changing credentials.

## Graphify And Reference Material

Amelia/Graphify material is local reference only:

- `reference/graphify/saas-core/` is the preferred graph for architecture questions.
- `reference/graphify/backend/` is useful for backend/persistence details.
- `archive/graphify-full/` is noisy and should be used only when the focused graphs miss something.

## Current Implementation Pointer

Phases 1-6 (`T001`-`T061`) are complete and stack decisions live in `docs/adr/`. The next task is `T062` (Phase 7, User Story 5) in:

```text
specs/001-saas-multitenant-booking/tasks.md
```
