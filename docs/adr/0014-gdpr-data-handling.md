# ADR-0014: GDPR Data Handling — Export, Anonymization, and Retention

**Status:** Accepted  
**Date:** 2026-06-15  
**Tasks:** T059, T060, T076

## Context

The platform processes personal data (customer PII: name, email, phone) on behalf of tenants, making each tenant a data controller and the platform a data processor under GDPR (EU) 2016/679. Obligations include: right of access (data export), right to erasure (anonymization or deletion), and data minimization.

## Decision

**Export (Article 15 / 20):**

- `GdprExportService.export(tenantId, customerId)` returns a JSON bundle of all booking, notification, and audit records for that customer.
- Export is restricted to tenants on plans with the `gdpr_export` feature flag.
- The export job runs as a background task with a download link delivered via email; the bundle expires after 48 hours.

**Anonymization (Article 17):**

- `GdprAnonymizationService.anonymize(tenantId, customerId)` replaces PII fields with hashed or redacted values in-place.
- Booking records are retained (for financial audit) but customer identifying fields are zeroed: `customerEmail → anon_{sha256(email)}@deleted.invalid`, `customerName → [deleted]`, `customerPhone → null`.
- The anonymization is irreversible and records an audit event `gdpr.anonymized`.

**Retention:**

- Booking financial records: 7-year retention (EU accounting rules).
- Audit logs: 2-year retention, then archived to cold storage.
- Attachment files: deleted on customer anonymization request.
- Credential vault entries: deleted immediately on tenant offboarding.

**Lawful basis tracking:**

- Each tenant configures the lawful basis for processing (contract, legitimate interest, or consent) in their tenant settings.
- Consent records (where applicable) are stored separately from bookings and are purged on withdrawal.

## Consequences

- GDPR compliance is enforced by the platform, not delegated to tenants.
- Export and anonymization are gated on the `gdpr_export` billing feature, ensuring the feature is only available on plans that include compliance tooling (Starter and above include it per the plan definitions).
- Anonymization preserves booking count aggregates for analytics while removing linkability to individuals.
