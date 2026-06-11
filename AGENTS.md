## Cross-Agent Continuity

This project is designed to work across Codex and Claude without losing context.

Read these files in order at the start of a new session:

1. `HANDOFF.md` — current resume point and next actions.
2. `PLANNING.md` — project map, source-of-truth hierarchy, operating model.
3. `PROGRESS.md` — timeline of completed work and current state.
4. `.specify/memory/constitution.md` — non-negotiable architecture principles.
5. `specs/001-saas-multitenant-booking/plan.md` — current technical plan.
6. `specs/001-saas-multitenant-booking/tasks.md` — implementation backlog.

Before ending a meaningful session, update `PROGRESS.md` and `HANDOFF.md`. If tasks were completed, update `tasks.md`. If a major architecture decision was made, record it under `docs/adr/`.

Do not push, publish, merge, delete reference material, or change credentials without explicit user approval.

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
at specs/001-saas-multitenant-booking/plan.md
<!-- SPECKIT END -->
