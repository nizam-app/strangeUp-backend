import { randomUUID } from "node:crypto";
import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeSocialCreatedCursor, encodeSocialCreatedCursor } from "./social-cursor.js";
import {
  assertFullAccess,
  loadVisibleSocialTarget,
  socialForbidden,
  socialNotFound,
} from "./social-access.js";
import {
  canonicalizeParticipantPair,
  decideMessageRequestCreate,
  decideMessageRequestRespond,
} from "./social-policy.js";
import { SOCIAL_LIST_DEFAULT_LIMIT, SOCIAL_LIST_MAX_LIMIT } from "./social.constants.js";
import { toSocialUserPreview, type MessageRequestDto } from "./social.dto.js";
import type { MessageRequestListQuery } from "./social.validation.js";

export class MessageRequestService {
  constructor(private readonly db: DatabaseClient) {}

  async create(
    viewer: User,
    targetUserId: string,
  ): Promise<{ dto: MessageRequestDto; created: boolean }> {
    const loaded = await loadVisibleSocialTarget(this.db, viewer, targetUserId);
    const existing = await this.db.directMessageRequest.findUnique({
      where: { senderId_recipientId: { senderId: viewer.id, recipientId: targetUserId } },
    });
    const decision = decideMessageRequestCreate(existing?.status ?? null);
    if (decision === "declined") {
      throw new AppError("CONFLICT", "Message request was declined", 409);
    }
    if (decision === "return_existing" && existing) {
      return { dto: await this.toDto(viewer, existing.id), created: false };
    }

    const created = await this.db.directMessageRequest.create({
      data: {
        senderId: viewer.id,
        recipientId: targetUserId,
        status: "PENDING",
      },
    });
    return { dto: await this.toDto(viewer, created.id, loaded.blocked), created: true };
  }

  async list(
    viewer: User,
    query: MessageRequestListQuery,
  ): Promise<{
    requests: MessageRequestDto[];
    nextCursor: string | null;
  }> {
    assertFullAccess(viewer);
    const box = query.box ?? "inbox";
    const limit = Math.min(query.limit ?? SOCIAL_LIST_DEFAULT_LIMIT, SOCIAL_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeSocialCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.directMessageRequest.findMany({
      where: {
        ...(box === "inbox" ? { recipientId: viewer.id } : { senderId: viewer.id }),
        ...(query.status ? { status: query.status } : {}),
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
    });

    const page = rows.slice(0, limit);
    const requests: MessageRequestDto[] = [];
    for (const row of page) {
      const otherId = box === "inbox" ? row.senderId : row.recipientId;
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, otherId);
      if (blocked) {
        continue;
      }
      requests.push(await this.toDto(viewer, row.id, false));
    }

    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeSocialCreatedCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    return { requests, nextCursor };
  }

  async accept(viewer: User, requestId: string): Promise<MessageRequestDto> {
    assertFullAccess(viewer);
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "DirectMessageRequest" WHERE "id" = ${requestId} FOR UPDATE`;
      const request = await tx.directMessageRequest.findUnique({ where: { id: requestId } });
      if (!request) {
        throw socialNotFound();
      }
      const decision = decideMessageRequestRespond(
        request.status,
        request.recipientId === viewer.id,
        "accept",
      );
      if (decision === "forbidden") {
        throw socialNotFound();
      }
      if (decision === "already_declined") {
        throw new AppError("CONFLICT", "Message request was declined", 409);
      }

      const blocked = await isBlockedEitherDirection(tx, request.senderId, request.recipientId);
      if (blocked) {
        throw socialNotFound();
      }

      const { low, high } = canonicalizeParticipantPair(request.senderId, request.recipientId);
      const conversation = await tx.directConversation.upsert({
        where: {
          participantLowId_participantHighId: { participantLowId: low, participantHighId: high },
        },
        create: {
          id: randomUUID(),
          participantLowId: low,
          participantHighId: high,
        },
        update: {},
      });

      await tx.directConversationParticipant.upsert({
        where: {
          conversationId_userId: { conversationId: conversation.id, userId: request.senderId },
        },
        create: { conversationId: conversation.id, userId: request.senderId },
        update: {},
      });
      await tx.directConversationParticipant.upsert({
        where: {
          conversationId_userId: { conversationId: conversation.id, userId: request.recipientId },
        },
        create: { conversationId: conversation.id, userId: request.recipientId },
        update: {},
      });

      const now = new Date();
      await tx.directMessageRequest.update({
        where: { id: request.id },
        data: {
          status: "ACCEPTED",
          conversationId: conversation.id,
          respondedAt: request.respondedAt ?? now,
        },
      });

      const reverse = await tx.directMessageRequest.findUnique({
        where: {
          senderId_recipientId: { senderId: request.recipientId, recipientId: request.senderId },
        },
      });
      if (reverse && reverse.status === "PENDING") {
        await tx.directMessageRequest.update({
          where: { id: reverse.id },
          data: { status: "ACCEPTED", conversationId: conversation.id, respondedAt: now },
        });
      }
    });
    return this.toDto(viewer, requestId, false);
  }

  async decline(viewer: User, requestId: string): Promise<MessageRequestDto> {
    assertFullAccess(viewer);
    const request = await this.db.directMessageRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw socialNotFound();
    }
    const decision = decideMessageRequestRespond(
      request.status,
      request.recipientId === viewer.id,
      "decline",
    );
    if (decision === "forbidden") {
      throw socialNotFound();
    }
    if (decision === "already_accepted") {
      throw new AppError("CONFLICT", "Accepted message requests cannot be declined", 409);
    }
    if (decision === "already_declined") {
      return this.toDto(viewer, request.id);
    }

    const blocked = await isBlockedEitherDirection(this.db, viewer.id, request.senderId);
    if (blocked) {
      throw socialNotFound();
    }

    await this.db.directMessageRequest.update({
      where: { id: request.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    return this.toDto(viewer, request.id);
  }

  private async toDto(
    viewer: User,
    requestId: string,
    blocked = false,
  ): Promise<MessageRequestDto> {
    const row = await this.db.directMessageRequest.findUnique({
      where: { id: requestId },
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
        recipient: {
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
    if (!row) {
      throw socialNotFound();
    }
    if (row.senderId !== viewer.id && row.recipientId !== viewer.id) {
      throw socialForbidden();
    }
    const counterpart = row.senderId === viewer.id ? row.recipient : row.sender;
    return {
      requestId: row.id,
      status: row.status,
      counterpart: toSocialUserPreview(
        toDiscoverUserSnapshot(viewer),
        toDiscoverUserSnapshot(counterpart),
        counterpart.profile,
        blocked,
      ),
      conversationId: row.conversationId,
      createdAt: row.createdAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
    };
  }
}
