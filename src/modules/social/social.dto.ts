import type { DirectMessageRequestStatus } from "../../../generated/prisma/client.js";
import type { PublicProfilePreviewDto } from "../discovery/public-profile.dto.js";
import { toPublicProfilePreview } from "../discovery/public-profile.dto.js";
import {
  canViewPublicProfile,
  type DiscoverUserSnapshot,
} from "../policy/public-profile-policy.js";

export type SocialUserPreviewDto = PublicProfilePreviewDto;

const hiddenPreview = (userId: string): SocialUserPreviewDto => ({
  userId,
  displayName: null,
  username: null,
  hasAvatar: false,
  locationCity: null,
  locationRegion: null,
});

export function toSocialUserPreview(
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
): SocialUserPreviewDto {
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

export type FollowStateDto = {
  following: boolean;
  targetUserId: string;
};

export type WaveDto = {
  waveId: string;
  from: SocialUserPreviewDto;
  createdAt: string;
};

export type MessageRequestDto = {
  requestId: string;
  status: DirectMessageRequestStatus;
  counterpart: SocialUserPreviewDto;
  conversationId: string | null;
  createdAt: string;
  respondedAt: string | null;
};

export type DirectMessageDto = {
  messageId: string;
  conversationId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
};

export type ConversationSummaryDto = {
  conversationId: string;
  counterpart: SocialUserPreviewDto;
  lastMessage: { messageId: string; body: string; createdAt: string; authorUserId: string } | null;
  unreadCount: number;
  updatedAt: string;
};

/** Task 023A — header/message badge aggregates (REST only; no sockets). */
export type MessagingSummaryDto = {
  /** Unread 1:1 messages from others in accepted conversations (blocked threads excluded). */
  directUnread: number;
  /** Unread group chat messages from others in ACTIVE memberships (blocked authors excluded). */
  groupUnread: number;
  /** Pending inbox message requests (not blocked senders). Not included in `totalUnreadMessages`. */
  messageRequestsPending: number;
  /** `directUnread + groupUnread` — use for Messages tab badge; excludes requests and notifications. */
  totalUnreadMessages: number;
  /** Same as `totalUnreadMessages` (alias for header composition). */
  displayBadgeCount: number;
  directConversationsWithUnread: number;
  groupChatsWithUnread: number;
};

export type PublicProfileSocialDto = {
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
  conversationId: string | null;
};

const SENSITIVE_SOCIAL_KEYS = [
  "email",
  "phoneE164",
  "birthDate",
  "identityVerificationStatus",
  "avatarStorageKey",
  "meetingInstructions",
] as const;

export function socialDtoContainsSensitiveKeys(dto: object): boolean {
  const keys = new Set(Object.keys(dto));
  return SENSITIVE_SOCIAL_KEYS.some((key) => keys.has(key));
}
