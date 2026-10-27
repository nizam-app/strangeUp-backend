import { Prisma, type User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeSocialCreatedCursor, encodeSocialCreatedCursor } from "./social-cursor.js";
import { assertFullAccess, loadVisibleSocialTarget } from "./social-access.js";
import { SOCIAL_LIST_DEFAULT_LIMIT, SOCIAL_LIST_MAX_LIMIT } from "./social.constants.js";
import { toSocialUserPreview, type WaveDto } from "./social.dto.js";
import type { SocialListQuery } from "./social.validation.js";

export class WaveService {
  constructor(private readonly db: DatabaseClient) {}

  async sendWave(
    viewer: User,
    targetUserId: string,
  ): Promise<{ waved: true; targetUserId: string }> {
    await loadVisibleSocialTarget(this.db, viewer, targetUserId);
    try {
      await this.db.userWave.create({
        data: { senderId: viewer.id, recipientId: targetUserId },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
        throw err;
      }
    }
    return { waved: true, targetUserId };
  }

  async listIncoming(
    viewer: User,
    query: SocialListQuery,
  ): Promise<{
    waves: WaveDto[];
    nextCursor: string | null;
  }> {
    assertFullAccess(viewer);
    const limit = Math.min(query.limit ?? SOCIAL_LIST_DEFAULT_LIMIT, SOCIAL_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeSocialCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.userWave.findMany({
      where: {
        recipientId: viewer.id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        sender: {
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
      },
    });

    const page = rows.slice(0, limit);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const waves: WaveDto[] = [];
    for (const row of page) {
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.senderId);
      if (blocked) {
        continue;
      }
      waves.push({
        waveId: row.id,
        from: toSocialUserPreview(
          viewerSnapshot,
          toDiscoverUserSnapshot(row.sender),
          row.sender.profile,
          false,
        ),
        createdAt: row.createdAt.toISOString(),
      });
    }

    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeSocialCreatedCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    return { waves, nextCursor };
  }
}
