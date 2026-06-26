# API Contract: Admin Settings

**Feature**: 003-tenant-settings | **Date**: 2026-06-26

All routes are under the existing `/v1/admin/*` staff-auth gate and require a staff session with role
**admin** (FR-002). The tenant is the one **resolved from the request** (`X-Forwarded-Host`/Host,
ADR-0018); there is no `tenantId` path parameter (isolation is structural, FR-003). UI strings are
Spanish; errors use the existing problem shape (`{ error: code }`).

## Authentication & authorization

| Condition | Response |
|-----------|----------|
| No valid staff session | `401 unauthorized` |
| Valid staff session, role ≠ admin | `403 forbidden` |
| Valid customer session presented | `401`/`403` (not interchangeable, ADR-0005) |

---

## GET /v1/admin/settings

Return the resolved tenant's settings projection.

**Response 200**

```json
{
  "profile": { "displayName": "Mi Negocio" },
  "localization": {
    "defaultTimezone": "Europe/Madrid",
    "defaultLocale": "es-ES",
    "currency": "EUR"
  },
  "policies": {
    "cancellationMinNoticeHours": 24,
    "rescheduleMinNoticeHours": 24,
    "bookingHorizonDays": 60,
    "requiresApproval": false
  },
  "branding": { "primaryColor": "#1f6feb", "logoUrl": null }
}
```

---

## PATCH /v1/admin/settings

Partial, all-or-nothing update. The body may contain any subset of the four groups; within a group,
any subset of fields. The merge is validated **once** before persisting; if any field is invalid, no
field changes (FR-017).

**Request body** (all groups optional)

```json
{
  "profile": { "displayName": "Peluquería Ana" },
  "localization": { "defaultTimezone": "Europe/Madrid", "defaultLocale": "es-ES", "currency": "USD" },
  "policies": { "bookingHorizonDays": 30, "cancellationMinNoticeHours": 48, "requiresApproval": true },
  "branding": { "primaryColor": "#0b7d6b", "logoUrl": "tenants/abc/branding/logo.png" }
}
```

**Response 200** — the updated settings projection (same shape as `GET`).

**Response 400** — validation failure, no partial write:

| `error` code | Cause |
|--------------|-------|
| `invalid-timezone` | `defaultTimezone` is not a valid IANA zone (FR-005) |
| `invalid-currency` | `currency` is not an ISO-4217 allowlisted code (FR-007) |
| `invalid-locale` | `defaultLocale` empty/unsupported (FR-006) |
| `invalid-display-name` | `displayName` blank/whitespace (FR-004) |
| `policy-out-of-range` | negative notice hours or `bookingHorizonDays < 1` (FR-013) |
| `invalid-color` | `branding.primaryColor` not a valid hex color (FR-014) |
| `invalid-logo` | `branding.logoUrl` malformed (FR-015) |

**Response 401/403** — see authorization table.

### Behavior notes

- **Non-retroactive currency** (FR-008): changing `localization.currency` updates the tenant default
  only; existing services/bookings/payments keep their stored currency. New services created
  afterward inherit the new default.
- **Audit** (FR-018): each changed group emits its audit event (`tenant.localization-updated`,
  `tenant.policies-updated`, `tenant.branding-updated`) with the admin as actor.
- **Effect on engines** (FR-012): a saved `bookingHorizonDays` bounds `GET /v1/public/availability`;
  saved notice hours feed the existing change/cancel policy engine; a saved `primaryColor` overrides
  the design-system primary token at runtime on tenant surfaces.

---

## Admin console seam (Next.js, ADR-0018)

The console reaches these routes through its server-only seam, never from the browser directly.

| Console route handler | Maps to | Mode `demo` | Mode `api` |
|-----------------------|---------|-------------|------------|
| `GET /api/settings` | read settings | in-memory demo store | `GET /v1/admin/settings` |
| `PATCH /api/settings` | save settings | in-memory demo store | `PATCH /v1/admin/settings` |
