export type PublicInterestDto = {
  slug: string;
  label: string;
};

export type PublicProfilePreviewDto = {
  userId: string;
  displayName: string | null;
  username: string | null;
  hasAvatar: boolean;
  locationCity: string | null;
  locationRegion: string | null;
};

export type PublicProfileSocialCountsDto = {
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
  conversationId: string | null;
};

export type PublicProfileDto = PublicProfilePreviewDto & {
  bio: string | null;
  memberSince: string;
  interests: PublicInterestDto[];
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
  conversationId: string | null;
};

export function toPublicProfilePreview(row: {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarStorageKey: string | null;
  locationCity: string | null;
  locationRegion: string | null;
}): PublicProfilePreviewDto {
  return {
    userId: row.userId,
    displayName: row.displayName,
    username: row.username,
    hasAvatar: row.avatarStorageKey !== null,
    locationCity: row.locationCity,
    locationRegion: row.locationRegion,
  };
}

export function toPublicProfileDetail(
  row: {
    userId: string;
    displayName: string | null;
    username: string | null;
    bio: string | null;
    avatarStorageKey: string | null;
    locationCity: string | null;
    locationRegion: string | null;
    memberSince: Date;
  },
  interests: PublicInterestDto[],
  social: PublicProfileSocialCountsDto = {
    followerCount: 0,
    followingCount: 0,
    viewerFollows: false,
    conversationId: null,
  },
): PublicProfileDto {
  return {
    ...toPublicProfilePreview(row),
    bio: row.bio,
    memberSince: row.memberSince.toISOString(),
    interests,
    followerCount: social.followerCount,
    followingCount: social.followingCount,
    viewerFollows: social.viewerFollows,
    conversationId: social.conversationId,
  };
}
