/**
 * Design tokens as TypeScript constants (docs/design-system.md, ADR-0008),
 * for non-CSS consumers (emails, charts, inline styles). The CSS custom
 * properties in tokens.css are the runtime source of truth for web UIs.
 */

export const colors = {
  primary: "#5a48f5",
  primaryHover: "#4937d8",
  primarySoft: "#eeebfe",
  bg: "#f7f8fa",
  surface: "#ffffff",
  border: "#e4e7ec",
  text: "#1f2733",
  textMuted: "#5f6b7a",
  success: "#15803d",
  warning: "#b45309",
  danger: "#b91c1c",
} as const;

export const fontSans =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const textSizes = { sm: 13, base: 14, lg: 16, xl: 20 } as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 48 } as const;

export const radius = { sm: 6, md: 8, lg: 12 } as const;

/** Status color mapping shared by bookings and payments UI. */
export const statusColor: Record<string, string> = {
  pending: colors.warning,
  approved: colors.success,
  captured: colors.success,
  confirmed: colors.success,
  rejected: colors.danger,
  expired: colors.danger,
  failed: colors.danger,
  canceled: colors.textMuted,
  rescheduled: colors.textMuted,
};
