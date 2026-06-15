/**
 * Video-meeting provisioning service (T084).
 *
 * Orchestrates meeting creation/update/cancellation for bookings that have
 * the video_meetings feature enabled. Delegates to a MeetingProvider adapter,
 * persists the join URL in a MeetingRepository, and gates on the tenant's
 * billing plan via hasFeature.
 */

import type {
  MeetingProvider,
  MeetingDetails,
  MeetingPlatform,
} from "@saas-reservas/integrations/meetings/meeting-provider";
import { hasFeature, type TenantBilling } from "@saas-reservas/domain/billing/billing";

// ---------------------------------------------------------------------------
// Meeting repository port
// ---------------------------------------------------------------------------

export interface MeetingRepository {
  save(bookingId: string, details: MeetingDetails): Promise<void>;
  find(bookingId: string): Promise<MeetingDetails | null>;
  delete(bookingId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

export interface ProvisionMeetingRequest {
  tenantId: string;
  billing: TenantBilling;
  bookingId: string;
  platform: MeetingPlatform;
  title: string;
  startAt: Date;
  durationMinutes: number;
  participants: string[];
}

export type ProvisionResult =
  | { ok: true; details: MeetingDetails }
  | { ok: false; reason: "feature-not-enabled" | "provider-error"; error?: string | undefined };

export type UpdateResult =
  | { ok: true; details: MeetingDetails }
  | { ok: false; reason: "not-found" | "provider-error"; error?: string | undefined };

export type CancelResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "provider-error"; error?: string | undefined };

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class VideoMeetingProvisioningService {
  constructor(
    private readonly provider: MeetingProvider,
    private readonly repo: MeetingRepository,
  ) {}

  async provision(req: ProvisionMeetingRequest): Promise<ProvisionResult> {
    if (!hasFeature(req.billing, "video_meetings")) {
      return { ok: false, reason: "feature-not-enabled" };
    }

    try {
      const details = await this.provider.createMeeting({
        tenantId: req.tenantId,
        platform: req.platform,
        title: req.title,
        startAt: req.startAt,
        durationMinutes: req.durationMinutes,
        participants: req.participants,
        bookingId: req.bookingId,
      });
      await this.repo.save(req.bookingId, details);
      return { ok: true, details };
    } catch (err) {
      return {
        ok: false,
        reason: "provider-error",
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  }

  async update(
    tenantId: string,
    platform: MeetingPlatform,
    bookingId: string,
    changes: {
      startAt?: Date | undefined;
      durationMinutes?: number | undefined;
      participants?: string[] | undefined;
    },
  ): Promise<UpdateResult> {
    const existing = await this.repo.find(bookingId);
    if (existing === null) {
      return { ok: false, reason: "not-found" };
    }

    try {
      const updated = await this.provider.updateMeeting({
        tenantId,
        platform,
        meetingId: existing.meetingId,
        ...changes,
      });
      await this.repo.save(bookingId, updated);
      return { ok: true, details: updated };
    } catch (err) {
      return {
        ok: false,
        reason: "provider-error",
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  }

  async cancel(
    tenantId: string,
    _platform: MeetingPlatform,
    bookingId: string,
  ): Promise<CancelResult> {
    const existing = await this.repo.find(bookingId);
    if (existing === null) {
      return { ok: false, reason: "not-found" };
    }

    try {
      await this.provider.cancelMeeting(tenantId, existing.meetingId);
      await this.repo.delete(bookingId);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: "provider-error",
        error: err instanceof Error ? err.message : "unknown error",
      };
    }
  }

  getDetails(bookingId: string): Promise<MeetingDetails | null> {
    return this.repo.find(bookingId);
  }
}

// ---------------------------------------------------------------------------
// In-memory repository for tests
// ---------------------------------------------------------------------------

export class InMemoryMeetingRepository implements MeetingRepository {
  readonly meetings = new Map<string, MeetingDetails>();

  save(bookingId: string, details: MeetingDetails): Promise<void> {
    this.meetings.set(bookingId, details);
    return Promise.resolve();
  }

  find(bookingId: string): Promise<MeetingDetails | null> {
    return Promise.resolve(this.meetings.get(bookingId) ?? null);
  }

  delete(bookingId: string): Promise<void> {
    this.meetings.delete(bookingId);
    return Promise.resolve();
  }
}
