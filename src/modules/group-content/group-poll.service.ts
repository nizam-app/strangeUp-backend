import { randomUUID } from "node:crypto";
import type { User } from "../../../generated/prisma/client.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { loadMembership, requireActiveMember } from "../groups/group-access.js";
import { groupForbidden, groupNotFound } from "../groups/group-errors.js";
import type { GroupPollDto } from "./group-content.dto.js";
import {
  GROUP_POLL_MAX_CLOSES_DAYS,
  GROUP_POLL_MIN_CLOSES_MINUTES,
} from "./group-content.constants.js";
import { assertGroupCommunityInteractiveEnabled } from "./group-content-policy.js";
import type { CreateGroupPollBody, VoteGroupPollBody } from "./group-content.validation.js";

export class GroupPollService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
  ) {}

  async createPoll(
    viewer: User,
    groupId: string,
    postId: string,
    input: CreateGroupPollBody,
  ): Promise<GroupPollDto> {
    assertGroupCommunityInteractiveEnabled(this.env);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const post = await this.db.communityPost.findUnique({
      where: { id: postId },
      include: { poll: true },
    });
    if (!post || post.groupId !== groupId || post.moderation !== "VISIBLE") {
      throw groupNotFound();
    }
    if (post.authorId !== viewer.id) {
      throw groupForbidden("Only the post author can attach a poll");
    }
    if (post.poll) {
      throw new AppError("CONFLICT", "This post already has a poll", 409);
    }

    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    });
    if (!group || group.status !== "ACTIVE") {
      throw groupForbidden("This group is not accepting polls");
    }

    const closesAt = new Date(input.closesAt);
    this.assertValidClosesAt(closesAt);

    const poll = await this.db.$transaction(async (tx) => {
      const created = await tx.communityPoll.create({
        data: {
          postId,
          groupId,
          authorId: viewer.id,
          closesAt,
        },
      });
      await tx.communityPollOption.createMany({
        data: input.options.map((label, index) => ({
          id: randomUUID(),
          pollId: created.id,
          sortOrder: index,
          label,
        })),
      });
      return created;
    });

    return this.loadPollDto(viewer.id, poll.id);
  }

  async getPoll(viewer: User, groupId: string, postId: string): Promise<GroupPollDto> {
    assertGroupCommunityInteractiveEnabled(this.env);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const poll = await this.db.communityPoll.findFirst({
      where: { postId, groupId },
    });
    if (!poll) {
      throw groupNotFound();
    }

    const post = await this.db.communityPost.findUnique({
      where: { id: postId },
      select: { moderation: true, groupId: true },
    });
    if (!post || post.groupId !== groupId || post.moderation !== "VISIBLE") {
      throw groupNotFound();
    }

    return this.loadPollDto(viewer.id, poll.id);
  }

  async vote(
    viewer: User,
    groupId: string,
    postId: string,
    input: VoteGroupPollBody,
  ): Promise<GroupPollDto> {
    assertGroupCommunityInteractiveEnabled(this.env);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const poll = await this.db.communityPoll.findFirst({
      where: { postId, groupId },
      include: {
        post: { select: { moderation: true } },
        options: { select: { id: true } },
      },
    });
    if (!poll || poll.post.moderation !== "VISIBLE") {
      throw groupNotFound();
    }

    const now = new Date();
    if (poll.closesAt.getTime() <= now.getTime()) {
      throw new AppError("CONFLICT", "This poll is closed", 409);
    }

    const optionBelongs = poll.options.some((o) => o.id === input.optionId);
    if (!optionBelongs) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }

    try {
      await this.db.communityPollVote.create({
        data: {
          pollId: poll.id,
          userId: viewer.id,
          optionId: input.optionId,
        },
      });
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
        throw new AppError("CONFLICT", "You have already voted on this poll", 409);
      }
      throw err;
    }

    return this.loadPollDto(viewer.id, poll.id);
  }

  async loadPollForPostIfEnabled(
    viewerId: string,
    groupId: string,
    postId: string,
  ): Promise<GroupPollDto | null> {
    if (!this.env.GROUP_COMMUNITY_INTERACTIVE_ENABLED) {
      return null;
    }
    const poll = await this.db.communityPoll.findFirst({
      where: { postId, groupId },
    });
    if (!poll) {
      return null;
    }
    return this.loadPollDto(viewerId, poll.id);
  }

  private assertValidClosesAt(closesAt: Date): void {
    const now = Date.now();
    const minMs = GROUP_POLL_MIN_CLOSES_MINUTES * 60 * 1000;
    const maxMs = GROUP_POLL_MAX_CLOSES_DAYS * 24 * 60 * 60 * 1000;
    const delta = closesAt.getTime() - now;
    if (Number.isNaN(closesAt.getTime()) || delta < minMs || delta > maxMs) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }
  }

  private async loadPollDto(viewerId: string, pollId: string): Promise<GroupPollDto> {
    const poll = await this.db.communityPoll.findUniqueOrThrow({
      where: { id: pollId },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        votes: { select: { userId: true, optionId: true } },
      },
    });

    const now = new Date();
    const voteCounts = new Map<string, number>();
    for (const opt of poll.options) {
      voteCounts.set(opt.id, 0);
    }
    for (const vote of poll.votes) {
      voteCounts.set(vote.optionId, (voteCounts.get(vote.optionId) ?? 0) + 1);
    }

    const myVote = poll.votes.find((v) => v.userId === viewerId);

    return {
      pollId: poll.id,
      postId: poll.postId,
      groupId: poll.groupId,
      closesAt: poll.closesAt.toISOString(),
      closed: poll.closesAt.getTime() <= now.getTime(),
      totalVotes: poll.votes.length,
      options: poll.options.map((o) => ({
        optionId: o.id,
        label: o.label,
        voteCount: voteCounts.get(o.id) ?? 0,
      })),
      myVoteOptionId: myVote?.optionId ?? null,
    };
  }
}
