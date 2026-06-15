/**
 * T084 – Video-meeting provisioning service tests.
 */

import { describe, it, expect } from "vitest";
import {
  VideoMeetingProvisioningService,
  InMemoryMeetingRepository,
} from "@saas-reservas/api/application/integrations/videomeeting-provisioning-service";
import { FakeMeetingProvider } from "@saas-reservas/integrations/meetings/meeting-provider";
import {
  PROFESSIONAL_PLAN,
  ENTERPRISE_PLAN,
  STARTER_PLAN,
} from "@saas-reservas/domain/billing/billing";
import type { TenantBilling } from "@saas-reservas/domain/billing/billing";

function makeBilling(plan = ENTERPRISE_PLAN): TenantBilling {
  return {
    tenantId: "t1",
    planId: plan.id,
    plan,
    status: "active",
    currentPeriodStart: "2026-06-01",
    currentPeriodEnd: "2026-07-01",
    usage: { bookingsThisPeriod: 0, notificationsThisPeriod: 0, storageUsedBytes: 0 },
  };
}

function makeService() {
  const provider = new FakeMeetingProvider();
  const repo = new InMemoryMeetingRepository();
  const svc = new VideoMeetingProvisioningService(provider, repo);
  return { provider, repo, svc };
}

describe("VideoMeetingProvisioningService", () => {
  describe("provision", () => {
    it("creates a meeting and persists details", async () => {
      const { svc, repo } = makeService();
      const result = await svc.provision({
        tenantId: "t1",
        billing: makeBilling(),
        bookingId: "bk-1",
        platform: "google_meet",
        title: "Consultation",
        startAt: new Date("2026-06-20T10:00:00Z"),
        durationMinutes: 60,
        participants: ["a@example.com", "b@example.com"],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.details.joinUrl).toContain("https://");
      expect(repo.meetings.has("bk-1")).toBe(true);
    });

    it("rejects when tenant plan does not include video_meetings", async () => {
      const { svc } = makeService();
      const result = await svc.provision({
        tenantId: "t1",
        billing: makeBilling(PROFESSIONAL_PLAN), // no video_meetings
        bookingId: "bk-2",
        platform: "zoom",
        title: "Demo",
        startAt: new Date("2026-06-21T09:00:00Z"),
        durationMinutes: 30,
        participants: [],
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("feature-not-enabled");
    });

    it("rejects when billing status is canceled even on enterprise plan", async () => {
      const { svc } = makeService();
      const billing = makeBilling(ENTERPRISE_PLAN);
      const result = await svc.provision({
        tenantId: "t1",
        billing: { ...billing, status: "canceled" },
        bookingId: "bk-3",
        platform: "teams",
        title: "Meeting",
        startAt: new Date(),
        durationMinutes: 30,
        participants: [],
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("feature-not-enabled");
    });

    it("starter plan cannot provision video meetings", async () => {
      const { svc } = makeService();
      const result = await svc.provision({
        tenantId: "t1",
        billing: makeBilling(STARTER_PLAN),
        bookingId: "bk-4",
        platform: "google_meet",
        title: "Call",
        startAt: new Date(),
        durationMinutes: 30,
        participants: [],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("update", () => {
    it("updates an existing meeting", async () => {
      const { svc } = makeService();
      await svc.provision({
        tenantId: "t1",
        billing: makeBilling(),
        bookingId: "bk-1",
        platform: "google_meet",
        title: "Initial",
        startAt: new Date("2026-06-20T10:00:00Z"),
        durationMinutes: 60,
        participants: [],
      });
      const result = await svc.update("t1", "google_meet", "bk-1", {
        durationMinutes: 90,
      });
      expect(result.ok).toBe(true);
    });

    it("returns not-found when booking has no meeting", async () => {
      const { svc } = makeService();
      const result = await svc.update("t1", "google_meet", "nonexistent", {});
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("not-found");
    });
  });

  describe("cancel", () => {
    it("cancels and removes meeting from repo", async () => {
      const { svc, repo } = makeService();
      await svc.provision({
        tenantId: "t1",
        billing: makeBilling(),
        bookingId: "bk-1",
        platform: "google_meet",
        title: "Call",
        startAt: new Date(),
        durationMinutes: 30,
        participants: [],
      });
      const result = await svc.cancel("t1", "google_meet", "bk-1");
      expect(result.ok).toBe(true);
      expect(repo.meetings.has("bk-1")).toBe(false);
    });

    it("returns not-found when booking has no meeting", async () => {
      const { svc } = makeService();
      const result = await svc.cancel("t1", "google_meet", "ghost");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("not-found");
    });
  });

  describe("getDetails", () => {
    it("returns null for unknown bookingId", async () => {
      const { svc } = makeService();
      expect(await svc.getDetails("nope")).toBeNull();
    });

    it("returns meeting details after provisioning", async () => {
      const { svc } = makeService();
      await svc.provision({
        tenantId: "t1",
        billing: makeBilling(),
        bookingId: "bk-1",
        platform: "google_meet",
        title: "Call",
        startAt: new Date(),
        durationMinutes: 30,
        participants: [],
      });
      const details = await svc.getDetails("bk-1");
      expect(details).not.toBeNull();
      expect(details?.platform).toBe("google_meet");
    });
  });
});
