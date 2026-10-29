import { Prisma, type User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeGroupCreatedCursor, encodeGroupCreatedCursor } from "./group-cursor.js";
import { groupConflict, groupForbidden, groupNotFound } from "./group-errors.js";
import {
  assertCanArchive,
  assertCanTransfer,
  assertGroupAccess,
  assertGroupActiveForMutation,
  countActiveMembers,
  groupPublicSelect,
  loadMembership,
  membershipUserSelect,
  requireActiveMember,
  requireManager,
} from "./group-access.js";
import {
  canRemoveMember,
  decideApproveRequest,
  decideDeclineRequest,
  decideGroupJoin,
  decideGroupLeave,
  hasOpenMemberSeat,
} from "./group-policy.js";
import {
  toGroupSummaryDto,
  toGroupUserPreview,
  type GroupJoinRequestDto,
  type GroupMemberDto,
  type GroupViewerMembershipDto,
} from "./group.dto.js";
import { GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT } from "./group.constants.js";
import type {
  ChangeMemberRoleInput,
  GroupCursorListQuery,
  TransferOwnershipInput,
} from "./group.validation.js";
import { NotificationEmitter } from "../notifications/notification-emitter.service.js";

export class GroupMembershipService {
  private readonly notifications: NotificationEmitter;

  constructor(
    private readonly db: DatabaseClient,
    notifications?: NotificationEmitter,
  ) {
    this.notifications = notifications ?? new NotificationEmitter(db);
  }

  async join(viewer: User, groupId: string): Promise<GroupViewerMembershipDto> {
    assertGroupAccess(viewer);
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "CommunityGroup" WHERE "id" = ${groupId} FOR UPDATE`;
        const group = await tx.communityGroup.findUnique({
          where: { id: groupId },
          select: { id: true, privacy: true, status: true, memberCapacity: true, ownerId: true },
        });
        if (!group) {
          throw groupNotFound();
        }

        const existing = await tx.communityMembership.findUnique({
          where: { groupId_userId: { groupId, userId: viewer.id } },
        });
        const activeCount = await countActiveMembers(tx, groupId);
        const decision = decideGroupJoin({
          groupStatus: group.status,
          privacy: group.privacy,
          existingStatus: existing?.status ?? null,
          hasOpenSeat: hasOpenMemberSeat(activeCount, group.memberCapacity),
        });

        if (decision === "already_active") {
          return { status: "ACTIVE" as const, role: existing!.role };
        }
        if (decision === "already_pending") {
          return { status: "PENDING" as const, role: null };
        }
        if (decision === "closed") {
          throw groupForbidden("This group is not open for joins");
        }
        if (decision === "full") {
          throw groupConflict("This group is at capacity");
        }

        const nextStatus = decision === "join_immediate" ? "ACTIVE" : "PENDING";
        const nextRole = nextStatus === "ACTIVE" ? "MEMBER" : "MEMBER";
        const now = new Date();
        const saved = existing
          ? await tx.communityMembership.update({
              where: { id: existing.id },
              data: {
                status: nextStatus,
                role: nextRole,
                respondedAt: nextStatus === "ACTIVE" ? now : null,
                approverId: null,
              },
            })
          : await tx.communityMembership.create({
              data: {
                groupId,
                userId: viewer.id,
                status: nextStatus,
                role: nextRole,
                respondedAt: nextStatus === "ACTIVE" ? now : null,
              },
            });

        return {
          status: saved.status,
          role: saved.status === "ACTIVE" ? saved.role : null,
        };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await this.db.communityMembership.findUnique({
          where: { groupId_userId: { groupId, userId: viewer.id } },
        });
        if (existing) {
          return {
            status: existing.status,
            role: existing.status === "ACTIVE" ? existing.role : null,
          };
        }
      }
      throw err;
    }
  }

  async leave(viewer: User, groupId: string): Promise<{ left: true }> {
    assertGroupAccess(viewer);
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "CommunityGroup" WHERE "id" = ${groupId} FOR UPDATE`;
      const group = await tx.communityGroup.findUnique({
        where: { id: groupId },
        select: { id: true },
      });
      if (!group) {
        throw groupNotFound();
      }
      const existing = await tx.communityMembership.findUnique({
        where: { groupId_userId: { groupId, userId: viewer.id } },
      });
      const decision = decideGroupLeave({
        existingStatus: existing?.status ?? null,
        role: existing?.role ?? null,
      });
      if (decision === "owner_blocked") {
        throw groupForbidden("Transfer ownership before leaving this group");
      }
      if (decision === "already_left") {
        return;
      }
      if (!existing) {
        return;
      }
      await tx.communityMembership.update({
        where: { id: existing.id },
        data: {
          status: "LEFT",
          role: "MEMBER",
          respondedAt: new Date(),
        },
      });
    });
    const { onUserLeftGroup } = await import(
      "../messaging-realtime/messaging-realtime.lifecycle.js"
    );
    void onUserLeftGroup(viewer.id, groupId).catch(() => undefined);
    return { left: true };
  }

  async listMembers(
    viewer: User,
    groupId: string,
    query: GroupCursorListQuery,
  ): Promise<{ members: GroupMemberDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);
    const membership = requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) {
      throw groupNotFound();
    }
    void membership;

    const limit = Math.min(query.limit ?? GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeGroupCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.communityMembership.findMany({
      where: {
        groupId,
        status: "ACTIVE",
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
      include: { user: { select: membershipUserSelect } },
    });

    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const page = rows.slice(0, limit);
    const members: GroupMemberDto[] = [];
    for (const row of page) {
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.userId);
      members.push({
        user: toGroupUserPreview(
          viewerSnapshot,
          toDiscoverUserSnapshot(row.user),
          row.user.profile,
          blocked,
        ),
        role: row.role,
        joinedAt: row.createdAt.toISOString(),
      });
    }
    const last = page[page.length - 1];
    return {
      members,
      nextCursor:
        rows.length > limit && last
          ? encodeGroupCreatedCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async listJoinRequests(
    viewer: User,
    groupId: string,
    query: GroupCursorListQuery,
  ): Promise<{ requests: GroupJoinRequestDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);
    requireManager(await loadMembership(this.db, groupId, viewer.id));

    const limit = Math.min(query.limit ?? GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeGroupCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.communityMembership.findMany({
      where: {
        groupId,
        status: "PENDING",
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      include: { user: { select: membershipUserSelect } },
    });

    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const page = rows.slice(0, limit);
    const requests: GroupJoinRequestDto[] = [];
    for (const row of page) {
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.userId);
      requests.push({
        membershipId: row.id,
        user: toGroupUserPreview(
          viewerSnapshot,
          toDiscoverUserSnapshot(row.user),
          row.user.profile,
          blocked,
        ),
        createdAt: row.createdAt.toISOString(),
      });
    }
    const last = page[page.length - 1];
    return {
      requests,
      nextCursor:
        rows.length > limit && last
          ? encodeGroupCreatedCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async approve(
    viewer: User,
    groupId: string,
    memberId: string,
  ): Promise<GroupViewerMembershipDto> {
    assertGroupAccess(viewer);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "CommunityGroup" WHERE "id" = ${groupId} FOR UPDATE`;
      const actor = await tx.communityMembership.findUnique({
        where: { groupId_userId: { groupId, userId: viewer.id } },
      });
      requireManager(actor);
      const group = await tx.communityGroup.findUnique({
        where: { id: groupId },
        select: { status: true, memberCapacity: true },
      });
      if (!group) {
        throw groupNotFound();
      }
      const target = await tx.communityMembership.findUnique({
        where: { id: memberId },
      });
      if (!target || target.groupId !== groupId) {
        throw groupNotFound();
      }
      const activeCount = await countActiveMembers(tx, groupId);
      const decision = decideApproveRequest({
        status: target.status,
        hasOpenSeat: hasOpenMemberSeat(activeCount, group.memberCapacity),
        groupStatus: group.status,
      });
      if (decision === "already_active") {
        return { status: "ACTIVE" as const, role: target.role };
      }
      if (decision === "closed") {
        throw groupForbidden("This group is not open for joins");
      }
      if (decision === "full") {
        throw groupConflict("This group is at capacity");
      }
      if (decision === "not_pending") {
        throw groupConflict("This membership request cannot be approved");
      }
      const saved = await tx.communityMembership.update({
        where: { id: target.id },
        data: {
          status: "ACTIVE",
          role: "MEMBER",
          approverId: viewer.id,
          respondedAt: new Date(),
        },
      });
      await this.notifications.emitInTransaction(tx, {
        recipientId: target.userId,
        type: "GROUP_MEMBERSHIP_APPROVED",
        actorUserId: viewer.id,
        sourceId: groupId,
        title: "Group membership approved",
        body: "You can now view posts and group chat.",
        dedupeKey: `group-membership-approved:${groupId}:${target.userId}`,
      });
      return { status: saved.status, role: saved.role };
    });
  }

  async decline(viewer: User, groupId: string, memberId: string): Promise<{ declined: true }> {
    assertGroupAccess(viewer);
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "CommunityGroup" WHERE "id" = ${groupId} FOR UPDATE`;
      const group = await tx.communityGroup.findUnique({
        where: { id: groupId },
        select: { status: true },
      });
      if (!group) {
        throw groupNotFound();
      }
      assertGroupActiveForMutation(group.status);
      const actor = await tx.communityMembership.findUnique({
        where: { groupId_userId: { groupId, userId: viewer.id } },
      });
      requireManager(actor);
      const target = await tx.communityMembership.findUnique({
        where: { id: memberId },
      });
      if (!target || target.groupId !== groupId) {
        throw groupNotFound();
      }
      const decision = decideDeclineRequest(target.status);
      if (decision === "already_declined") {
        return;
      }
      if (decision === "not_pending") {
        throw groupConflict("This membership request cannot be declined");
      }
      await tx.communityMembership.update({
        where: { id: target.id },
        data: {
          status: "DECLINED",
          role: "MEMBER",
          approverId: viewer.id,
          respondedAt: new Date(),
        },
      });
      await this.notifications.emitInTransaction(tx, {
        recipientId: target.userId,
        type: "GROUP_MEMBERSHIP_DECLINED",
        actorUserId: viewer.id,
        sourceId: groupId,
        title: "Group membership declined",
        body: "Your request to join this group was declined.",
        dedupeKey: `group-membership-declined:${groupId}:${target.userId}`,
      });
    });
    return { declined: true };
  }

  async remove(viewer: User, groupId: string, userId: string): Promise<{ removed: true }> {
    assertGroupAccess(viewer);
    let removedUserId: string | null = null;
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "CommunityGroup" WHERE "id" = ${groupId} FOR UPDATE`;
      const group = await tx.communityGroup.findUnique({
        where: { id: groupId },
        select: { status: true },
      });
      if (!group) {
        throw groupNotFound();
      }
      assertGroupActiveForMutation(group.status);
      const actor = await tx.communityMembership.findUnique({
        where: { groupId_userId: { groupId, userId: viewer.id } },
      });
      requireManager(actor);
      const target = await tx.communityMembership.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (!target || target.status !== "ACTIVE") {
        throw groupNotFound();
      }
      if (!canRemoveMember(actor!.role, target.role)) {
        throw groupForbidden("This member cannot be removed");
      }
      await tx.communityMembership.update({
        where: { id: target.id },
        data: {
          status: "REMOVED",
          role: "MEMBER",
          approverId: viewer.id,
          respondedAt: new Date(),
        },
      });
      removedUserId = target.userId;
    });
    if (removedUserId) {
      const { onUserLeftGroup } = await import(
        "../messaging-realtime/messaging-realtime.lifecycle.js"
      );
      void onUserLeftGroup(removedUserId, groupId).catch(() => undefined);
    }
    return { removed: true };
  }

  async changeRole(
    viewer: User,
    groupId: string,
    userId: string,
    input: ChangeMemberRoleInput,
  ): Promise<GroupViewerMembershipDto> {
    assertGroupAccess(viewer);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "CommunityGroup" WHERE "id" = ${groupId} FOR UPDATE`;
      const group = await tx.communityGroup.findUnique({
        where: { id: groupId },
        select: { status: true },
      });
      if (!group) {
        throw groupNotFound();
      }
      assertGroupActiveForMutation(group.status);
      const actor = await tx.communityMembership.findUnique({
        where: { groupId_userId: { groupId, userId: viewer.id } },
      });
      if (!actor || actor.status !== "ACTIVE" || actor.role !== "OWNER") {
        throw groupNotFound();
      }
      const target = await tx.communityMembership.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (!target || target.status !== "ACTIVE") {
        throw groupNotFound();
      }
      if (target.role === "OWNER") {
        throw groupForbidden("Transfer ownership instead of changing the owner role");
      }
      const saved = await tx.communityMembership.update({
        where: { id: target.id },
        data: { role: input.role },
      });
      return { status: saved.status, role: saved.role };
    });
  }

  async transferOwnership(
    viewer: User,
    groupId: string,
    input: TransferOwnershipInput,
  ): Promise<GroupViewerMembershipDto> {
    assertGroupAccess(viewer);
    if (input.userId === viewer.id) {
      throw groupForbidden("Cannot transfer ownership to yourself");
    }
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "CommunityGroup" WHERE "id" = ${groupId} FOR UPDATE`;
      const group = await tx.communityGroup.findUnique({
        where: { id: groupId },
        select: { status: true },
      });
      if (!group) {
        throw groupNotFound();
      }
      assertGroupActiveForMutation(group.status);
      const actor = await tx.communityMembership.findUnique({
        where: { groupId_userId: { groupId, userId: viewer.id } },
      });
      assertCanTransfer(actor?.status === "ACTIVE" ? actor.role : null);
      const target = await tx.communityMembership.findUnique({
        where: { groupId_userId: { groupId, userId: input.userId } },
      });
      if (!target || target.status !== "ACTIVE") {
        throw groupNotFound();
      }
      await tx.communityMembership.update({
        where: { id: actor!.id },
        data: { role: "MEMBER" },
      });
      await tx.communityMembership.update({
        where: { id: target.id },
        data: { role: "OWNER" },
      });
      await tx.communityGroup.update({
        where: { id: groupId },
        data: { ownerId: input.userId },
      });
      return { status: "ACTIVE" as const, role: "MEMBER" as const };
    });
  }

  async archive(viewer: User, groupId: string): Promise<ReturnType<typeof toGroupSummaryDto>> {
    assertGroupAccess(viewer);
    const actor = await loadMembership(this.db, groupId, viewer.id);
    assertCanArchive(actor?.status === "ACTIVE" ? actor.role : null);
    const current = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    });
    if (!current) {
      throw groupNotFound();
    }
    assertGroupActiveForMutation(current.status);
    const group = await this.db.communityGroup.update({
      where: { id: groupId },
      data: { status: "ARCHIVED" },
      select: {
        ...groupPublicSelect,
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
    });
    return toGroupSummaryDto({
      groupId: group.id,
      name: group.name,
      description: group.description,
      category: group.category,
      tags: group.tags.map((item) => item.tag),
      locationCity: group.locationCity,
      locationRegion: group.locationRegion,
      privacy: group.privacy,
      meetupFrequency: group.meetupFrequency,
      memberCapacity: group.memberCapacity,
      memberCount: group._count.memberships,
      coverStorageKey: group.coverStorageKey,
      status: group.status,
      myMembership: { status: "ACTIVE", role: "OWNER" },
    });
  }
}
