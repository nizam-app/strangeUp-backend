import type {
  Activity,
  ActivityCategory,
  Profile,
  ProfileVisibility,
  User,
} from "../../../generated/prisma/client.js";
import type { DiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import type { PublicActivitySource } from "./activity.dto.js";
import { toActivityHostPreview } from "./activity.dto.js";

export type ActivityWithRelations = Activity & {
  category: Pick<ActivityCategory, "slug" | "label">;
  host: Pick<
    User,
    | "id"
    | "accountStatus"
    | "emailVerifiedAt"
    | "ageEligibilityStatus"
    | "suspendedAt"
    | "deletedAt"
    | "identityVerificationStatus"
  > & {
    profile: Pick<
      Profile,
      | "displayName"
      | "username"
      | "avatarStorageKey"
      | "locationCity"
      | "locationRegion"
      | "profileVisibility"
    > | null;
  };
};

export const activityPublicSelect = {
  id: true,
  hostId: true,
  title: true,
  description: true,
  categoryId: true,
  coverStorageKey: true,
  coverContentType: true,
  startsAt: true,
  endsAt: true,
  timeZone: true,
  mode: true,
  status: true,
  audience: true,
  venueName: true,
  locationCity: true,
  locationRegion: true,
  meetingInstructions: true,
  virtualMeetingDetails: true,
  skillNotes: true,
  gearNotes: true,
  capacity: true,
  waitlistEnabled: true,
  publishedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { slug: true, label: true } },
  host: {
    select: {
      id: true,
      accountStatus: true,
      emailVerifiedAt: true,
      ageEligibilityStatus: true,
      suspendedAt: true,
      deletedAt: true,
      identityVerificationStatus: true,
      profile: {
        select: {
          displayName: true,
          username: true,
          avatarStorageKey: true,
          locationCity: true,
          locationRegion: true,
          profileVisibility: true,
        },
      },
    },
  },
} as const;

export function toPublicActivitySource(
  row: ActivityWithRelations,
  confirmedCount: number,
): PublicActivitySource {
  const hostProfile = row.host.profile;
  return {
    activityId: row.id,
    title: row.title,
    description: row.description,
    category: { slug: row.category.slug, label: row.category.label },
    coverStorageKey: row.coverStorageKey,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timeZone: row.timeZone,
    mode: row.mode,
    status: row.status,
    audience: row.audience,
    venueName: row.venueName,
    locationCity: row.locationCity,
    locationRegion: row.locationRegion,
    skillNotes: row.skillNotes,
    gearNotes: row.gearNotes,
    capacity: row.capacity,
    confirmedCount,
    waitlistEnabled: row.waitlistEnabled,
    host: {
      userId: row.host.id,
      displayName: hostProfile?.displayName ?? null,
      username: hostProfile?.username ?? null,
      avatarStorageKey: hostProfile?.avatarStorageKey ?? null,
      locationCity: hostProfile?.locationCity ?? null,
      locationRegion: hostProfile?.locationRegion ?? null,
    },
  };
}

export function hostPreviewForViewer(
  viewer: DiscoverUserSnapshot,
  row: ActivityWithRelations,
  blockedEitherDirection: boolean,
) {
  const hostSnapshot: DiscoverUserSnapshot = toDiscoverUserSnapshot({
    id: row.host.id,
    accountStatus: row.host.accountStatus,
    emailVerifiedAt: row.host.emailVerifiedAt,
    ageEligibilityStatus: row.host.ageEligibilityStatus,
    suspendedAt: row.host.suspendedAt,
    deletedAt: row.host.deletedAt,
    identityVerificationStatus: row.host.identityVerificationStatus,
  });
  const visibility: ProfileVisibility =
    row.host.profile?.profileVisibility ?? "VERIFIED_USERS_ONLY";
  return toActivityHostPreview(
    viewer,
    hostSnapshot,
    {
      profileVisibility: visibility,
      displayName: row.host.profile?.displayName ?? null,
      username: row.host.profile?.username ?? null,
      avatarStorageKey: row.host.profile?.avatarStorageKey ?? null,
      locationCity: row.host.profile?.locationCity ?? null,
      locationRegion: row.host.profile?.locationRegion ?? null,
    },
    blockedEitherDirection,
  );
}
