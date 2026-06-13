# Design System

Visual and interaction rules for every SaaS Reservas web surface (admin,
booking widget, staff portal, customer portal). The direction is
**Holded-style** (https://holded.com): a light, calm, data-dense business SaaS.
Decision record: `docs/adr/0008-design-system.md`. Implementation:
`packages/ui` (tokens today, shared components as screens demand them).

## Hard Rules

1. **No emojis** anywhere in product UI, user-facing strings, notification
   templates, or API responses. Meaning is conveyed with text and icons.
2. **Icons come from Lucide** (https://lucide.dev) via `lucide-react`, always
   through the `Icon` conventions below. A future `assets/icons/` folder may
   add brand-owned SVGs behind the same wrapper; call sites must not change.
3. **No app-local palettes or spacing.** Apps consume tokens from
   `packages/ui`; new values are added to the tokens, never inlined.

## Look And Feel (Holded-inspired)

- Light UI: near-white app background, white cards/surfaces, 1px subtle
  borders, soft shadows only on overlays.
- One confident primary color (indigo) used sparingly: primary actions,
  active navigation, focus rings. Everything else stays neutral.
- Generous whitespace and an 8px spacing rhythm; dense tables are allowed but
  padded.
- Rounded corners (8px default, 12px cards), pill badges for statuses.
- Admin surfaces use a fixed left sidebar (icon + label) with a top bar for
  context/actions; public surfaces (widget, portals) are single-column,
  card-centered, max-width ~560px.
- Tenant branding overrides `--ui-color-primary` (and logo) at runtime; all
  primary-derived styles must read the CSS variable, never the hex.

## Tokens (source of truth: `packages/ui/src/tokens.css`)

| Group  | Token                      | Value                   | Use                                |
| ------ | -------------------------- | ----------------------- | ---------------------------------- |
| Color  | `--ui-color-primary`       | `#5a48f5`               | Primary actions, active nav, focus |
| Color  | `--ui-color-primary-hover` | `#4937d8`               | Hover on primary                   |
| Color  | `--ui-color-primary-soft`  | `#eeebfe`               | Selected/soft backgrounds          |
| Color  | `--ui-color-bg`            | `#f7f8fa`               | App background                     |
| Color  | `--ui-color-surface`       | `#ffffff`               | Cards, panels, inputs              |
| Color  | `--ui-color-border`        | `#e4e7ec`               | 1px borders, dividers              |
| Color  | `--ui-color-text`          | `#1f2733`               | Primary text                       |
| Color  | `--ui-color-text-muted`    | `#5f6b7a`               | Secondary text, labels             |
| Color  | `--ui-color-success`       | `#15803d`               | Confirmations, paid, approved      |
| Color  | `--ui-color-warning`       | `#b45309`               | Pending, attention                 |
| Color  | `--ui-color-danger`        | `#b91c1c`               | Errors, destructive actions        |
| Type   | `--ui-font-sans`           | Inter, system-ui stack  | All text                           |
| Type   | `--ui-text-sm/base/lg/xl`  | 13/14/16/20px           | Body 14px; data tables 13px        |
| Space  | `--ui-space-1..8`          | 4/8/12/16/20/24/32/48px | 8px rhythm                         |
| Radius | `--ui-radius-sm/md/lg`     | 6/8/12px                | Inputs / buttons / cards           |
| Shadow | `--ui-shadow-overlay`      | soft, low               | Popovers and modals only           |

Status color mapping (bookings/payments): `pending` warning, `approved`/
`captured` success, `rejected`/`expired`/`failed` danger, `canceled`/
`rescheduled` muted.

## Iconography

- Import icons individually: `import { CalendarDays } from "lucide-react"`.
- Default size 16 inside text/buttons, 20 in navigation; `strokeWidth` 2;
  color inherits `currentColor`.
- Icons accompany text on actions; icon-only buttons require `aria-label`.
- Recurring vocabulary (keep consistent): `CalendarDays` agenda/availability,
  `Clock` slots/duration, `Users` attendees/customers, `Ticket` events,
  `CreditCard` payments, `Undo2` refunds, `Settings` configuration, `Shield`
  permissions/privacy, `ListOrdered` waitlist, `Building2` tenant.

## Components (grow in `packages/ui` as needed)

Conventions for the first set — Button (primary/secondary/danger; 36px high),
Input + Label (always visible labels, errors in danger below the field),
Card (surface + border + `--ui-radius-lg`, 24px padding), Badge (status pill,
soft background), Table (13px, muted uppercase headers, row hover
`--ui-color-bg`). Forms: labels above fields, primary action right-aligned at
the bottom, destructive actions never primary-colored.

## Language

- UI copy in Spanish (tenant locale will drive i18n later), sentence case,
  no exclamation marks, no emojis.
- Dates/times always in the tenant or provider time zone, never raw ISO in UI.
