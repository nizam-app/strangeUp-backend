import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import type { AvatarStorage } from "../profile-media/local-avatar-storage.js";
import { toPolicyActor } from "../policy/account-policy.js";
import {
  canBrowseDiscovery,
  canViewPublicProfile,
  toDiscoverUserSnapshot,
} from "../policy/public-profile-policy.js";
import { PUBLIC_NOT_FOUND_MESSAGE } from "./discovery.constants.js";
import { toPublicProfileDetail } from "./public-profile.dto.js";

export class PublicProfileService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly avatarStorage: AvatarStorage,
  ) {}

  private async loadTargetForViewer(viewer: User, targetUserId: string) {
    const actor = toPolicyActor(viewer);
    if (!canBrowseDiscovery(actor)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Discovery is not available in the current account state",
        403,
      );
    }

    const target = await this.db.user.findUnique({
      where: { id: targetUserId },
      include: {
        profile: true,
      },
    });

    if (!target?.profile) {
      throw new AppError("NOT_FOUND", PUBLIC_NOT_FOUND_MESSAGE, 404);
    }

    const blocked = await isBlockedEitherDirection(this.db, viewer.id, targetUserId);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const targetSnapshot = toDiscoverUserSnapshot(target);

    if (
      !canViewPublicProfile(
        viewerSnapshot,
        targetSnapshot,
        target.profile.profileVisibility,
        blocked,
      )
    ) {
      throw new AppError("NOT_FOUND", PUBLIC_NOT_FOUND_MESSAGE, 404);
    }

    return { target, profile: target.profile };
  }

  async getPublicProfile(viewer: User, targetUserId: string) {
    const { target, profile } = await this.loadTargetForViewer(viewer, targetUserId);

    const interestRows = await this.db.userInterest.findMany({
      where: { userId: target.id },
      include: { interest: { select: { slug: true, label: true, sortOrder: true } } },
      orderBy: { interest: { sortOrder: "asc" } },
    });

    const [followerCount, followingCount, viewerFollow, acceptedRequest] = await Promise.all([
      this.db.userFollow.count({ where: { followingId: target.id } }),
      this.db.userFollow.count({ where: { followerId: target.id } }),
      this.db.userFollow.findUnique({
        where: { followerId_followingId: { followerId: viewer.id, followingId: target.id } },
        select: { followerId: true },
      }),
      this.db.directMessageRequest.findFirst({
        where: {
          status: "ACCEPTED",
          OR: [
            { senderId: viewer.id, recipientId: target.id },
            { senderId: target.id, recipientId: viewer.id },
          ],
        },
        select: { conversationId: true },
      }),
    ]);

    return toPublicProfileDetail(
      {
        userId: target.id,
        displayName: profile.displayName,
        username: profile.username,
        bio: profile.bio,
        avatarStorageKey: profile.avatarStorageKey,
        locationCity: profile.locationCity,
        locationRegion: profile.locationRegion,
        memberSince: target.createdAt,
      },
      interestRows.map((row) => ({
        slug: row.interest.slug,
        label: row.interest.label,
      })),
      {
        followerCount,
        followingCount,
        viewerFollows: viewerFollow !== null,
        conversationId: acceptedRequest?.conversationId ?? null,
      },
    );
  }

  async getPublicAvatarBytes(
    viewer: User,
    targetUserId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const { target, profile } = await this.loadTargetForViewer(viewer, targetUserId);

    if (!profile.avatarStorageKey || !profile.avatarContentType) {
      throw new AppError("NOT_FOUND", PUBLIC_NOT_FOUND_MESSAGE, 404);
    }

    const buffer = await this.avatarStorage.readBytes(profile.avatarStorageKey, target.id);
    return { buffer, contentType: profile.avatarContentType };
  }
}
