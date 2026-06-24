#!/usr/bin/env bash
# SessionStart hook — surfaces the cross-agent continuity layer so a fresh
# session never "starts without context". Output goes to stdout and is injected
# into the agent's session context. Idempotent, read-only, non-interactive.
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT" 2>/dev/null || exit 0

echo "=== SaaS Reservas — arranque de sesion (continuidad) ==="
echo "Lee en orden: HANDOFF.md (abajo) -> PLANNING.md -> PROGRESS.md ->"
echo ".specify/memory/constitution.md -> specs/001-* (fundacional) ->"
echo "la feature activa (abajo): spec.md + plan.md + tasks.md ->"
echo "docs/analysis/menu-walkthrough-gap-analysis.md (indice de features)."
echo "Sigue 'Proximas acciones' del HANDOFF (abajo)."
echo "Prompt de arranque completo: docs/START_PROMPT.md"

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
echo "Rama actual: ${branch}"

if [ -f .specify/feature.json ]; then
  feat="$(sed -n 's/.*"feature_directory":"\([^"]*\)".*/\1/p' .specify/feature.json 2>/dev/null)"
  if [ -n "${feat:-}" ]; then
    echo "Feature Spec-Kit activa: ${feat}"
    [ -f "${feat}/plan.md" ] && [ -f "${feat}/tasks.md" ] && \
      echo "  -> planificada; si toca implementar, lee ${feat}/plan.md + ${feat}/tasks.md y usa /speckit-implement"
  fi
fi
echo

if [ -f HANDOFF.md ]; then
  echo "----- HANDOFF.md (punto de reanudacion) -----"
  cat HANDOFF.md
  echo "----- fin HANDOFF.md -----"
else
  echo "(HANDOFF.md no encontrado)"
fi

echo
echo "Antes de disenar UI o una feature nueva, lee docs/analysis/amelia-*-fine-grained.md del area."
