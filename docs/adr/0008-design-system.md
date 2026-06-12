# ADR-0008: Design System — Holded-Inspired UI With Lucide Icons

**Date**: 2026-06-12
**Status**: accepted
**Deciders**: Project owner + agent

## Context

The product ships several web surfaces (admin, booking widget, staff portal,
customer portal) that until now had unstyled, minimal UIs. The owner has set
the visual direction: interfaces in the style of Holded (https://holded.com) —
a clean, light, data-dense business SaaS — with two hard rules: emojis are
forbidden in product UI, and iconography starts with Lucide
(https://lucide.dev). Custom icon assets may be added later.

## Decision

- Adopt a single design system, documented in `docs/design-system.md` and
  implemented as code in `packages/ui` (design tokens first, shared components
  incrementally). All apps consume tokens from `packages/ui`; no app defines
  its own palette, spacing, or typography.
- Visual language: Holded-inspired — light surfaces, indigo/violet primary,
  generous whitespace, subtle 1px borders and shadows, rounded corners,
  left-sidebar admin layout, Inter/system-ui typography.
- Iconography: `lucide-react` exclusively for now. Emojis are prohibited in
  product UI, API responses, and user-facing strings. A future `assets/icons/`
  folder may add brand-owned icons behind the same `Icon` wrapper so call
  sites never change.
- Tenant branding (primary color, logo) overrides tokens at runtime via CSS
  custom properties, as the tenancy model already requires.

## Alternatives Considered

- Component library (MUI, Mantine, shadcn/ui): faster start, but locks the
  look away from the Holded direction and adds heavy dependencies; tokens +
  small owned components fit the constitution's adapter-minded discipline.
- Tailwind CSS: viable later; starting with plain CSS custom properties keeps
  the token contract framework-neutral and lets Tailwind map onto it if adopted.
- Per-app styling (status quo): already drifting; rejected.

## Consequences

- Every UI task from now on must use `packages/ui` tokens and `lucide-react`;
  PR review enforces the no-emoji rule.
- Existing minimal UIs (admin tenant-setup, booking-widget checkout) must be
  restyled to the system as they are next touched.
- Follow-up: shared components (Button, Input, Card, Table, Sidebar) grow in
  `packages/ui` as US screens demand them; a Storybook or preview page can be
  added when the component count justifies it.
