/**
 * Video meeting adapter boundary (T071, constitution principle IV).
 *
 * MeetingProvider is the interface implemented by Google Meet, Zoom, and
 * Microsoft Teams adapters. Credentials come from the credential vault scoped
 * to (tenantId, provider). FakeMeetingProvider is deterministic for tests.
 */

export type MeetingPlatform = "google_meet" | "zoom" | "teams";

export interface CreateMeetingParams {
  tenantId: string;
  platform: MeetingPlatform;
  title: string;
  startAt: Date;
  durationMinutes: number;
  /** List of participant email addresses */
  participants: string[];
  bookingId: string;
}

export interface MeetingDetails {
  meetingId: string;
  joinUrl: string;
  hostUrl?: string | undefined;
  platform: MeetingPlatform;
  startAt: Date;
  durationMinutes: number;
}

export interface UpdateMeetingParams {
  tenantId: string;
  platform: MeetingPlatform;
  meetingId: string;
  startAt?: Date | undefined;
  durationMinutes?: number | undefined;
  participants?: string[] | undefined;
}

export interface MeetingProvider {
  readonly platform: MeetingPlatform;
  createMeeting(params: CreateMeetingParams): Promise<MeetingDetails>;
  updateMeeting(params: UpdateMeetingParams): Promise<MeetingDetails>;
  cancelMeeting(tenantId: string, meetingId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Fake provider for tests
// ---------------------------------------------------------------------------

export interface CapturedMeetingOp {
  op: "create" | "update" | "cancel";
  tenantId: string;
  meetingId: string;
}

export class FakeMeetingProvider implements MeetingProvider {
  readonly platform: MeetingPlatform;
  readonly ops: CapturedMeetingOp[] = [];
  readonly meetings = new Map<string, MeetingDetails>();
  private sequence = 0;

  constructor(platform: MeetingPlatform = "google_meet") {
    this.platform = platform;
  }

  createMeeting(params: CreateMeetingParams): Promise<MeetingDetails> {
    this.sequence += 1;
    const meetingId = `meet_${this.sequence.toString()}`;
    const details: MeetingDetails = {
      meetingId,
      joinUrl: `https://fake.meet/join/${meetingId}`,
      hostUrl: `https://fake.meet/host/${meetingId}`,
      platform: this.platform,
      startAt: params.startAt,
      durationMinutes: params.durationMinutes,
    };
    this.meetings.set(meetingId, details);
    this.ops.push({ op: "create", tenantId: params.tenantId, meetingId });
    return Promise.resolve(details);
  }

  updateMeeting(params: UpdateMeetingParams): Promise<MeetingDetails> {
    const existing = this.meetings.get(params.meetingId);
    if (existing === undefined) throw new Error(`Meeting not found: ${params.meetingId}`);
    const updated: MeetingDetails = {
      ...existing,
      startAt: params.startAt ?? existing.startAt,
      durationMinutes: params.durationMinutes ?? existing.durationMinutes,
    };
    this.meetings.set(params.meetingId, updated);
    this.ops.push({ op: "update", tenantId: params.tenantId, meetingId: params.meetingId });
    return Promise.resolve(updated);
  }

  cancelMeeting(tenantId: string, meetingId: string): Promise<void> {
    this.meetings.delete(meetingId);
    this.ops.push({ op: "cancel", tenantId, meetingId });
    return Promise.resolve();
  }
}
