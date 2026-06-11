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
