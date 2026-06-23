---
name: handoff
description: Compacta la conversación actual en el HANDOFF.md durable del repo para que otro agente retome el trabajo.
argument-hint: "¿En qué se centrará la próxima sesión?"
disable-model-invocation: true
---

Refresca `HANDOFF.md` (raíz del repo) para que un agente nuevo pueda continuar.

Adaptación de la skill genérica `handoff` a este proyecto: en lugar de escribir en
el directorio temporal del SO (efímero, y en el entorno remoto se descarta), se
actualiza el **`HANDOFF.md` durable y versionado**, que es la capa de continuidad
canónica (ver `PLANNING.md` › "Modelo de documentos").

## Reglas

- **No dupliques** contenido ya capturado en otros artefactos (PRDs, planes, ADRs,
  specs, commits, diffs, el gap-analysis). Refiérelos por ruta o URL.
- **Redacta** información sensible (API keys, contraseñas, PII).
- Si el usuario pasó argumentos, trátalos como el **foco de la próxima sesión** y
  adapta "Próximas acciones" a ello.
- Mantén `HANDOFF.md` **corto** (punto de reanudación, no diario): el historial
  cronológico va en `PROGRESS.md`; el backlog de features en
  `docs/analysis/menu-walkthrough-gap-analysis.md`.

## Estructura a producir en HANDOFF.md

1. Encabezado + `Last updated:` con la fecha de hoy.
2. **Punto de reanudación** — dónde estamos (rama, estado, qué entregó esta sesión).
3. **Próximas acciones (priorizadas)** — adaptadas a los argumentos si los hay.
4. **Blockers / notas de entorno**.
5. **Punteros** — dónde vive cada cosa.
6. **Suggested skills** — qué skills debería invocar el próximo agente (p. ej.
   `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`).
7. **Reglas de cierre de sesión**.

## Después de escribir

Recuerda al usuario actualizar también `PROGRESS.md` (entrada fechada) si la sesión
tuvo cambios relevantes, y no hacer push/merge sin su aprobación explícita.
