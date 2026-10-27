import type { User } from "../../../generated/prisma/client.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { loadMembership, requireActiveMember } from "../groups/group-access.js";
import { groupNotFound } from "../groups/group-errors.js";
import type { GroupContentReportDto } from "./group-content.dto.js";
import { assertGroupCommunityInteractiveEnabled } from "./group-content-policy.js";
import type { CreateContentReportBody } from "./group-content.validation.js";

export class GroupContentReportService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
  ) {}

  async createReport(
    viewer: User,
    groupId: string,
    input: CreateContentReportBody,
  ): Promise<GroupContentReportDto> {
    assertGroupCommunityInteractiveEnabled(this.env);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    await this.assertTargetExists(groupId, input.targetType, input.targetId);

    try {
      const row = await this.db.communityContentReport.create({
        data: {
          groupId,
          reporterId: viewer.id,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
          detail: input.detail ?? null,
        },
      });
      return this.toDto(row);
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
        throw new AppError("CONFLICT", "You have already reported this content", 409);
      }
      throw err;
    }
  }

  async listOpenForModerators(viewer: User, groupId: string): Promise<GroupContentReportDto[]> {
    assertGroupCommunityInteractiveEnabled(this.env);
    const membership = requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    if (membership.role === "MEMBER") {
      throw new AppError("AUTH_FORBIDDEN", "Group action is not available", 403);
    }

    const rows = await this.db.communityContentReport.findMany({
      where: { groupId, status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  private async assertTargetExists(
    groupId: string,
    targetType: CreateContentReportBody["targetType"],
    targetId: string,
  ): Promise<void> {
    if (targetType === "POST") {
      const post = await this.db.communityPost.findUnique({ where: { id: targetId } });
      if (!post || post.groupId !== groupId || post.moderation !== "VISIBLE") {
        throw groupNotFound();
      }
      return;
    }
    if (targetType === "STORY") {
      const story = await this.db.communityGroupStory.findUnique({ where: { id: targetId } });
      if (!story || story.groupId !== groupId || story.moderation !== "VISIBLE") {
        throw groupNotFound();
      }
      return;
    }
    const media = await this.db.communityGroupMedia.findUnique({ where: { id: targetId } });
    if (
      !media ||
      media.groupId !== groupId ||
      media.kind !== "POST_ATTACHMENT" ||
      media.lifecycle !== "ACTIVE"
    ) {
      throw groupNotFound();
    }
  }

  private toDto(row: {
    id: string;
    groupId: string;
    targetType: "POST" | "STORY" | "POST_MEDIA";
    targetId: string;
    reason: "SPAM" | "HARASSMENT" | "INAPPROPRIATE_MEDIA" | "OTHER";
    status: "OPEN" | "RESOLVED" | "DISMISSED";
    createdAt: Date;
  }): GroupContentReportDto {
    return {
      reportId: row.id,
      groupId: row.groupId,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
