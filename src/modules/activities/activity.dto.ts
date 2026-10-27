import type {
  ActivityAudience,
  ActivityMode,
  ActivityParticipationState,
  ActivityStatus,
} from "../../../generated/prisma/client.js";
import type { PublicProfilePreviewDto } from "../discovery/public-profile.dto.js";
import { toPublicProfilePreview } from "../discovery/public-profile.dto.js";
import {
  canViewPublicProfile,
  type DiscoverUserSnapshot,
} from "../policy/public-profile-policy.js";

export type ActivityCategoryDto = {
  slug: string;
  label: string;
};

export type ActivityHostPreviewDto = PublicProfilePreviewDto;

export type MyParticipationDto = {
  state: Exclude<ActivityParticipationState, "CANCELLED">;
  waitlistPosition: number | null;
};

export type PublicActivityCardDto = {
  activityId: string;
  title: string;
  category: ActivityCategoryDto;
  hasCover: boolean;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  mode: ActivityMode;
  status: ActivityStatus;
  venueName: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  capacity: number;
  confirmedCount: number;
  spotsLeft: number;
  waitlistEnabled: boolean;
  host: ActivityHostPreviewDto;
};

export type PublicActivityDetailDto = PublicActivityCardDto & {
  description: string | null;
  skillNotes: string | null;
  gearNotes: string | null;
  audience: ActivityAudience;
  myParticipation: MyParticipationDto | null;
  meetingAvailable: boolean;
};

export type ActivityMeetingDto = {
  activityId: string;
  venueName: string | null;
  meetingInstructions: string | null;
  virtualMeetingDetails: string | null;
};

export type HostActivityDto = PublicActivityDetailDto & {
  meetingInstructions: string | null;
  virtualMeetingDetails: string | null;
  waitlistedCount: number;
  publishedAt: string | null;
  cancelledAt: string | null;
};

export type MyActivityRsvpDto = {
  activity: PublicActivityCardDto;
  myParticipation: MyParticipationDto;
};

export type ActivityHostSource = {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarStorageKey: string | null;
  locationCity: string | null;
  locationRegion: string | null;
};

export type PublicActivitySource = {
  activityId: string;
  title: string;
  description: string | null;
  category: ActivityCategoryDto;
  coverStorageKey: string | null;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  mode: ActivityMode;
  status: ActivityStatus;
  audience: ActivityAudience;
  venueName: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  skillNotes: string | null;
  gearNotes: string | null;
  capacity: number;
  confirmedCount: number;
  waitlistEnabled: boolean;
  host: ActivityHostSource;
};

function spotsLeft(capacity: number, confirmedCount: number): number {
  return Math.max(0, capacity - confirmedCount);
}

function hiddenHostPreview(userId: string): ActivityHostPreviewDto {
  return {
    userId,
    displayName: null,
    username: null,
    hasAvatar: false,
    locationCity: null,
    locationRegion: null,
  };
}

export function toActivityHostPreview(
  viewer: DiscoverUserSnapshot,
  host: DiscoverUserSnapshot,
  hostProfile: {
    profileVisibility: "EVERYONE" | "VERIFIED_USERS_ONLY";
    displayName: string | null;
    username: string | null;
    avatarStorageKey: string | null;
    locationCity: string | null;
    locationRegion: string | null;
  },
  blockedEitherDirection: boolean,
): ActivityHostPreviewDto {
  const visible = canViewPublicProfile(
    viewer,
    host,
    hostProfile.profileVisibility,
    blockedEitherDirection,
  );
  if (!visible) {
    return hiddenHostPreview(host.userId);
  }
  return toPublicProfilePreview({
    userId: host.userId,
    displayName: hostProfile.displayName,
    username: hostProfile.username,
    avatarStorageKey: hostProfile.avatarStorageKey,
    locationCity: hostProfile.locationCity,
    locationRegion: hostProfile.locationRegion,
  });
}

export function toPublicActivityCard(
  source: PublicActivitySource,
  hostPreview: ActivityHostPreviewDto,
): PublicActivityCardDto {
  return {
    activityId: source.activityId,
    title: source.title,
    category: source.category,
    hasCover: source.coverStorageKey !== null,
    startsAt: source.startsAt.toISOString(),
    endsAt: source.endsAt.toISOString(),
    timeZone: source.timeZone,
    mode: source.mode,
    status: source.status,
    venueName: source.venueName,
    locationCity: source.locationCity,
    locationRegion: source.locationRegion,
    capacity: source.capacity,
    confirmedCount: source.confirmedCount,
    spotsLeft: spotsLeft(source.capacity, source.confirmedCount),
    waitlistEnabled: source.waitlistEnabled,
    host: hostPreview,
  };
}

export function toPublicActivityDetail(
  source: PublicActivitySource,
  hostPreview: ActivityHostPreviewDto,
  myParticipation: MyParticipationDto | null,
  meetingAvailable: boolean,
): PublicActivityDetailDto {
  return {
    ...toPublicActivityCard(source, hostPreview),
    description: source.description,
    skillNotes: source.skillNotes,
    gearNotes: source.gearNotes,
    audience: source.audience,
    myParticipation,
    meetingAvailable,
  };
}

export function toActivityMeetingDto(row: {
  activityId: string;
  venueName: string | null;
  meetingInstructions: string | null;
  virtualMeetingDetails: string | null;
}): ActivityMeetingDto {
  return {
    activityId: row.activityId,
    venueName: row.venueName,
    meetingInstructions: row.meetingInstructions,
    virtualMeetingDetails: row.virtualMeetingDetails,
  };
}

export function toHostActivityDto(
  source: PublicActivitySource,
  hostPreview: ActivityHostPreviewDto,
  extras: {
    meetingInstructions: string | null;
    virtualMeetingDetails: string | null;
    waitlistedCount: number;
    publishedAt: Date | null;
    cancelledAt: Date | null;
    myParticipation: MyParticipationDto | null;
  },
): HostActivityDto {
  return {
    ...toPublicActivityDetail(source, hostPreview, extras.myParticipation, true),
    meetingInstructions: extras.meetingInstructions,
    virtualMeetingDetails: extras.virtualMeetingDetails,
    waitlistedCount: extras.waitlistedCount,
    publishedAt: extras.publishedAt?.toISOString() ?? null,
    cancelledAt: extras.cancelledAt?.toISOString() ?? null,
  };
}

export function toMyParticipationDto(row: {
  state: ActivityParticipationState;
  waitlistPosition: number | null;
}): MyParticipationDto | null {
  if (row.state === "CANCELLED") {
    return null;
  }
  return {
    state: row.state,
    waitlistPosition: row.state === "WAITLISTED" ? row.waitlistPosition : null,
  };
}

const SENSITIVE_ACTIVITY_KEYS = [
  "meetingInstructions",
  "virtualMeetingDetails",
  "coverStorageKey",
  "coverContentType",
] as const;

export function publicActivityDtoContainsSensitiveKeys(dto: object): boolean {
  const keys = new Set(Object.keys(dto));
  return SENSITIVE_ACTIVITY_KEYS.some((key) => keys.has(key));
}
