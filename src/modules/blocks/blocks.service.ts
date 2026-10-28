import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import {
  BLOCKS_LIST_DEFAULT_LIMIT,
  BLOCKS_LIST_MAX_LIMIT,
} from "../discovery/discovery.constants.js";
import { canBrowseDiscovery } from "../policy/public-profile-policy.js";
import { toPolicyActor } from "../policy/account-policy.js";
import type { blockUserBodySchema } from "./blocks.validation.js";
import type { z } from "zod";
import { onUserBlockEstablished } from "../messaging-realtime/messaging-realtime.lifecycle.js";

export type BlockListItemDto = {
  targetUserId: string;
  blockedAt: string;
};

export class BlocksService {
  constructor(private readonly db: DatabaseClient) {}

  private assertViewerCanManageBlocks(user: User): void {
    const actor = toPolicyActor(user);
    if (!canBrowseDiscovery(actor)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Discovery is not available in the current account state",
        403,
      );
    }
  }

  async blockUser(user: User, input: z.infer<typeof blockUserBodySchema>): Promise<void> {
    this.assertViewerCanManageBlocks(user);
    const targetUserId = input.targetUserId;
    if (targetUserId === user.id) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }

    const target = await this.db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }

    await this.db.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId } },
      create: { blockerId: user.id, blockedId: targetUserId },
      update: {},
    });
    void onUserBlockEstablished(this.db, user.id, targetUserId).catch(() => undefined);
  }

  async unblockUser(user: User, targetUserId: string): Promise<void> {
    this.assertViewerCanManageBlocks(user);
    await this.db.userBlock.deleteMany({
      where: { blockerId: user.id, blockedId: targetUserId },
    });
  }

  async listBlocks(
    user: User,
    options: { limit?: number; cursor?: string },
  ): Promise<{ blocks: BlockListItemDto[]; nextCursor: string | null }> {
    this.assertViewerCanManageBlocks(user);
    const limit = Math.min(options.limit ?? BLOCKS_LIST_DEFAULT_LIMIT, BLOCKS_LIST_MAX_LIMIT);

    let cursorBlockedAt: Date | undefined;
    let cursorTargetId: string | undefined;
    if (options.cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(options.cursor, "base64url").toString("utf8")) as {
          blockedAt: string;
          targetUserId: string;
        };
        cursorBlockedAt = new Date(parsed.blockedAt);
        cursorTargetId = parsed.targetUserId;
      } catch {
        throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
      }
    }

    const rows = await this.db.userBlock.findMany({
      where: {
        blockerId: user.id,
        ...(cursorBlockedAt && cursorTargetId
          ? {
              OR: [
                { createdAt: { gt: cursorBlockedAt } },
                { createdAt: cursorBlockedAt, blockedId: { gt: cursorTargetId } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { blockedId: "asc" }],
      take: limit + 1,
      select: { blockedId: true, createdAt: true },
    });

    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    const nextCursor =
      hasMore && page.length > 0
        ? Buffer.from(
            JSON.stringify({
              blockedAt: page[page.length - 1].createdAt.toISOString(),
              targetUserId: page[page.length - 1].blockedId,
            }),
            "utf8",
          ).toString("base64url")
        : null;

    return {
      blocks: page.map((row) => ({
        targetUserId: row.blockedId,
        blockedAt: row.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}
