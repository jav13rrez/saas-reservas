# Handoff

Last updated: 2026-06-11

## Read This First

This is the fastest resume document for Codex, Claude, or any future agent. Read this before making changes.

The project is ready to start implementation, but source code has not started yet.

## Current Objective

Prepare and implement a SaaS-native multitenant booking platform inspired by Amelia Premium, using the existing Spec Kit artifacts as the product and architecture source of truth.

## Current Repo State

- Branch: `main`
- Clean baseline commit: `7d6842e Initial clean project baseline`
- Remote: `origin https://github.com/jav13rrez/saas-reservas.git`
- Push status: dry-run was successful, but the final real push had not been done when this handoff was written.
- Local reference folders exist but are ignored by Git: `reference/`, `archive/`, `.codex/`.

## What Matters Most

Use these documents:

- `PLANNING.md`: map, route, and operating model.
- `PROGRESS.md`: what already happened.
- `.specify/memory/constitution.md`: non-negotiable principles.
- `specs/001-saas-multitenant-booking/plan.md`: technical architecture.
- `specs/001-saas-multitenant-booking/tasks.md`: implementation backlog.

Do not treat `reference/` or `archive/` as source code. They are local research inputs only.

## Next Actions

Recommended next steps:

1. Push the clean baseline if the user wants it on GitHub:

   ```bash
   git push -u origin main
   ```

2. Close the first architecture decisions before coding:

   - Next.js vs alternative frontend shell.
   - Fastify vs NestJS.
   - ORM/migrations strategy.
   - Redis queue library.
   - Auth/session model.
   - AI/model-provider abstraction timing.

3. Record those decisions as ADRs under `docs/adr/`.

4. Start `T001` through `T006` from `tasks.md`.

5. After each meaningful implementation session, update `PROGRESS.md`, `HANDOFF.md`, and `tasks.md`.

## Current Task Pointer

Implementation has not started.

Next task:

```text
T001 Create target workspace structure and placeholders in apps/admin/.gitkeep, services/api/src/.gitkeep, services/worker/src/.gitkeep, packages/domain/src/.gitkeep, and infra/postgres/.gitkeep
```

## Important Constraints

- Tenant isolation is non-negotiable.
- PostgreSQL RLS and `tenant_id` discipline are foundational.
- Redis keys, storage paths, worker payloads, webhooks, logs, metrics, and audit records must carry tenant identity.
- No confirmed booking without availability, resource, calendar, payment, and policy validation.
- WordPress and Amelia are references only; do not reproduce WordPress coupling.
- External integrations must be adapter-based.
- Secrets must never be committed.

## Reference Material

Local-only reference material:

- `reference/amelia-source/`: Amelia Premium plugin source.
- `reference/graphify/saas-core/`: most useful focused Graphify output.
- `reference/graphify/backend/`: backend-focused Graphify output.
- `archive/graphify-full/`: noisy full graph snapshot.

These paths are ignored by Git except for their README files.

## If Context Is Lost

Rebuild context in this order:

1. `README.md`
2. `HANDOFF.md`
3. `PLANNING.md`
4. `PROGRESS.md`
5. `.specify/memory/constitution.md`
6. `specs/001-saas-multitenant-booking/plan.md`
7. `specs/001-saas-multitenant-booking/tasks.md`

## Do Not Do Without Explicit User Approval

- Do not delete `reference/` or `archive/`.
- Do not push to GitHub unless the user confirms.
- Do not install ECC wholesale.
- Do not commit Amelia Premium source or Graphify generated heavy outputs.
- Do not change the constitution lightly.
- Do not choose a major framework silently if trade-offs are still open.
