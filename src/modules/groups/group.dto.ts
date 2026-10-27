import type {
  CommunityGroupMeetupFrequency,
  CommunityGroupPrivacy,
  CommunityGroupStatus,
  CommunityMembershipRole,
  CommunityMembershipStatus,
} from "../../../generated/prisma/client.js";
import type { PublicProfilePreviewDto } from "../discovery/public-profile.dto.js";
import { toPublicProfilePreview } from "../discovery/public-profile.dto.js";
import {
  canViewPublicProfile,
  type DiscoverUserSnapshot,
} from "../policy/public-profile-policy.js";

export type GroupCategoryDto = {
  slug: string;
  label: string;
};

export type GroupViewerMembershipDto = {
  status: CommunityMembershipStatus;
  role: CommunityMembershipRole | null;
};

export type GroupSummaryDto = {
  groupId: string;
  name: string;
  description: string | null;
  category: GroupCategoryDto;
  tags: string[];
  locationCity: string | null;
  locationRegion: string | null;
  privacy: CommunityGroupPrivacy;
  meetupFrequency: CommunityGroupMeetupFrequency | null;
  memberCapacity: number | null;
  memberCount: number;
  spotsLeft: number | null;
  hasCover: boolean;
  status: CommunityGroupStatus;
  myMembership: GroupViewerMembershipDto | null;
};

export type GroupDetailDto = GroupSummaryDto & {
  canAccessContent: boolean;
};

export type GroupManageDto = GroupDetailDto & {
  pendingRequestCount: number;
  visiblePostCount: number;
};

export type MyGroupDto = GroupSummaryDto & {
  role: CommunityMembershipRole | null;
  membershipStatus: CommunityMembershipStatus;
};

export type GroupMemberDto = {
  user: PublicProfilePreviewDto;
  role: CommunityMembershipRole;
  joinedAt: string;
};

export type GroupJoinRequestDto = {
  membershipId: string;
  user: PublicProfilePreviewDto;
  createdAt: string;
};

export type GroupPostDto = {
  postId: string;
  groupId: string;
  author: PublicProfilePreviewDto;
  body: string;
  activityId: string | null;
  pinned: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GroupCommentDto = {
  commentId: string;
  postId: string;
  author: PublicProfilePreviewDto;
  body: string;
  createdAt: string;
};

export type GroupMessageDto = {
  messageId: string;
  groupId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
};

export type GroupChatSummaryDto = {
  groupId: string;
  name: string;
  hasCover: boolean;
  lastMessage: { messageId: string; body: string; createdAt: string; authorUserId: string } | null;
  unreadCount: number;
  updatedAt: string;
};

function hiddenPreview(userId: string): PublicProfilePreviewDto {
  return {
    userId,
    displayName: null,
    username: null,
    hasAvatar: false,
    locationCity: null,
    locationRegion: null,
  };
}

export function toGroupUserPreview(
  viewer: DiscoverUserSnapshot,
  target: DiscoverUserSnapshot,
  profile: {
    profileVisibility: "EVERYONE" | "VERIFIED_USERS_ONLY";
    displayName: string | null;
    username: string | null;
    avatarStorageKey: string | null;
    locationCity: string | null;
    locationRegion: string | null;
  } | null,
  blockedEitherDirection: boolean,
): PublicProfilePreviewDto {
  if (!profile) {
    return hiddenPreview(target.userId);
  }
  const visible = canViewPublicProfile(
    viewer,
    target,
    profile.profileVisibility,
    blockedEitherDirection,
  );
  if (!visible) {
    return hiddenPreview(target.userId);
  }
  return toPublicProfilePreview({
    userId: target.userId,
    displayName: profile.displayName,
    username: profile.username,
    avatarStorageKey: profile.avatarStorageKey,
    locationCity: profile.locationCity,
    locationRegion: profile.locationRegion,
  });
}

export function spotsLeft(capacity: number | null, memberCount: number): number | null {
  if (capacity === null) {
    return null;
  }
  return Math.max(0, capacity - memberCount);
}

export function toGroupSummaryDto(input: {
  groupId: string;
  name: string;
  description: string | null;
  category: GroupCategoryDto;
  tags: string[];
  locationCity: string | null;
  locationRegion: string | null;
  privacy: CommunityGroupPrivacy;
  meetupFrequency: CommunityGroupMeetupFrequency | null;
  memberCapacity: number | null;
  memberCount: number;
  coverStorageKey: string | null;
  status: CommunityGroupStatus;
  myMembership: GroupViewerMembershipDto | null;
}): GroupSummaryDto {
  return {
    groupId: input.groupId,
    name: input.name,
    description: input.description,
    category: input.category,
    tags: input.tags,
    locationCity: input.locationCity,
    locationRegion: input.locationRegion,
    privacy: input.privacy,
    meetupFrequency: input.meetupFrequency,
    memberCapacity: input.memberCapacity,
    memberCount: input.memberCount,
    spotsLeft: spotsLeft(input.memberCapacity, input.memberCount),
    hasCover: input.coverStorageKey !== null,
    status: input.status,
    myMembership: input.myMembership,
  };
}

const SENSITIVE_GROUP_KEYS = [
  "email",
  "phoneE164",
  "birthDate",
  "identityVerificationStatus",
  "avatarStorageKey",
  "coverStorageKey",
  "coverContentType",
  "meetingInstructions",
  "virtualMeetingDetails",
  "verifiedCommunity",
  "verified",
  "distanceMiles",
  "nearby",
] as const;

export function groupDtoContainsSensitiveKeys(dto: object): boolean {
  const keys = new Set(Object.keys(dto));
  return SENSITIVE_GROUP_KEYS.some((key) => keys.has(key));
}
