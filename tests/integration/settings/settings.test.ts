/**
 * Tenant settings application service (feature 003): getSettings + the
 * all-or-nothing updateSettings over the in-memory store. Covers localization,
 * policies, branding, audit emission, all-or-nothing validation, and
 * cross-tenant isolation. (Drizzle/RLS parity is exercised by the e2e + the
 * persistence suite.)
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryEventSink } from "@saas-reservas/api/application/events";
import { TenantAdminService } from "@saas-reservas/api/application/tenancy/tenant-admin-service";
import { InMemoryStore } from "@saas-reservas/api/infrastructure/memory/in-memory-store";
import { SYSTEM_ACTOR } from "@saas-reservas/domain/audit/events";

const actor = SYSTEM_ACTOR;

describe("tenant settings service", () => {
  let store: InMemoryStore;
  let events: InMemoryEventSink;
  let service: TenantAdminService;
  let tenantId: string;

  beforeEach(async () => {
    store = new InMemoryStore();
    events = new InMemoryEventSink();
    service = new TenantAdminService(store, events);
    const tenant = await service.createTenant({
      slug: "acme-co",
      displayName: "Acme Co",
      defaultTimezone: "Europe/Madrid",
      actor,
    });
    tenantId = tenant.id;
  });

  it("reads the current settings projection with the default currency", async () => {
    const settings = await service.getSettings(tenantId);
    expect(settings.profile.displayName).toBe("Acme Co");
    expect(settings.localization.currency).toBe("EUR");
    expect(settings.localization.defaultTimezone).toBe("Europe/Madrid");
    expect(settings.policies.bookingHorizonDays).toBe(60);
    expect(settings.branding.primaryColor).toBe("#1f6feb");
  });

  it("updates localization + profile and audits localization-updated", async () => {
    const updated = await service.updateSettings({
      tenantId,
      profile: { displayName: "Peluquería Ana" },
      localization: {
        defaultTimezone: "America/New_York",
        defaultLocale: "en-US",
        currency: "USD",
      },
      actor,
    });
    expect(updated.profile.displayName).toBe("Peluquería Ana");
    expect(updated.localization.currency).toBe("USD");
    const reread = await service.getSettings(tenantId);
    expect(reread.localization.defaultTimezone).toBe("America/New_York");
    expect(events.audits.some((a) => a.action === "tenant.localization-updated")).toBe(true);
  });

  it("updates policies and branding with their own audit actions", async () => {
    await service.updateSettings({
      tenantId,
      policies: { bookingHorizonDays: 7, cancellationMinNoticeHours: 48, requiresApproval: true },
      branding: { primaryColor: "#0b7d6b" },
      actor,
    });
    const settings = await service.getSettings(tenantId);
    expect(settings.policies.bookingHorizonDays).toBe(7);
    expect(settings.policies.requiresApproval).toBe(true);
    expect(settings.branding.primaryColor).toBe("#0b7d6b");
    expect(events.audits.some((a) => a.action === "tenant.policies-updated")).toBe(true);
    expect(events.audits.some((a) => a.action === "tenant.branding-updated")).toBe(true);
  });

  it("is all-or-nothing: one invalid field changes nothing", async () => {
    await expect(
      service.updateSettings({
        tenantId,
        // valid currency alongside an invalid timezone: neither must be applied
        localization: { defaultTimezone: "Mars/Phobos", currency: "USD" },
        actor,
      }),
    ).rejects.toMatchObject({ code: "invalid-timezone" });
    const settings = await service.getSettings(tenantId);
    expect(settings.localization.defaultTimezone).toBe("Europe/Madrid");
    expect(settings.localization.currency).toBe("EUR");
  });

  it("rejects invalid currency, policy range, color, and blank name", async () => {
    await expect(
      service.updateSettings({ tenantId, localization: { currency: "eur" }, actor }),
    ).rejects.toMatchObject({ code: "invalid-currency" });
    await expect(
      service.updateSettings({ tenantId, policies: { bookingHorizonDays: 0 }, actor }),
    ).rejects.toMatchObject({ code: "policy-out-of-range" });
    await expect(
      service.updateSettings({ tenantId, branding: { primaryColor: "blue" }, actor }),
    ).rejects.toMatchObject({ code: "invalid-color" });
    await expect(
      service.updateSettings({ tenantId, profile: { displayName: "   " }, actor }),
    ).rejects.toMatchObject({ code: "invalid-display-name" });
  });

  it("keeps tenants isolated: updating one does not affect another", async () => {
    const other = await service.createTenant({
      slug: "other-co",
      displayName: "Other Co",
      defaultTimezone: "Europe/Madrid",
      actor,
    });
    await service.updateSettings({
      tenantId,
      localization: { currency: "GBP" },
      actor,
    });
    const otherSettings = await service.getSettings(other.id);
    expect(otherSettings.localization.currency).toBe("EUR");
  });
});
