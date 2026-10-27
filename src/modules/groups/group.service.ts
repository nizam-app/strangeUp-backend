import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { processAvatarUpload } from "../profile-media/avatar-image-processor.js";
import { GROUP_CATEGORY_CATALOG } from "./group-catalog.js";
import { decodeGroupCreatedCursor, encodeGroupCreatedCursor } from "./group-cursor.js";
import { groupForbidden, groupNotFound } from "./group-errors.js";
import {
  assertCanEditCore,
  assertCanEditRestricted,
  assertGroupAccess,
  countActiveMembers,
  groupPublicSelect,
  loadMembership,
  type GroupPublicRow,
} from "./group-access.js";
import type { GroupCoverStorage } from "./group-cover.storage.js";
import {
  canDecreaseMemberCapacity,
  canNonMemberSeeCover,
  isDiscoverableGroupStatus,
} from "./group-policy.js";
import { buildDiscoverableGroupsWhere } from "./group-query.js";
import {
  toGroupSummaryDto,
  type GroupCategoryDto,
  type GroupDetailDto,
  type GroupManageDto,
  type GroupSummaryDto,
  type GroupViewerMembershipDto,
  type MyGroupDto,
} from "./group.dto.js";
import { GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT } from "./group.constants.js";
import type {
  CreateGroupInput,
  GroupListQuery,
  MyGroupListQuery,
  PatchGroupInput,
} from "./group.validation.js";

function categoryDto(row: { slug: string; label: string }): GroupCategoryDto {
  return { slug: row.slug, label: row.label };
}

function membershipDto(
  row: {
    status: GroupViewerMembershipDto["status"];
    role: GroupViewerMembershipDto["role"];
  } | null,
): GroupViewerMembershipDto | null {
  if (!row) {
    return null;
  }
  return {
    status: row.status,
    role: row.status === "ACTIVE" ? row.role : null,
  };
}

export class GroupService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly coverStorage: GroupCoverStorage,
  ) {}

  async listCategories(viewer: User): Promise<{ categories: GroupCategoryDto[] }> {
    assertGroupAccess(viewer);
    const rows = await this.db.communityGroupCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, label: true },
    });
    return { categories: rows };
  }

  async listDiscoverable(
    viewer: User,
    query: GroupListQuery,
  ): Promise<{ groups: GroupSummaryDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);
    const limit = Math.min(query.limit ?? GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeGroupCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.communityGroup.findMany({
      where: buildDiscoverableGroupsWhere({ query, cursor }),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        ...groupPublicSelect,
        memberships: {
          where: { userId: viewer.id },
          select: { status: true, role: true },
          take: 1,
        },
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
    });

    const page = rows.slice(0, limit);
    const groups = page.map((row) =>
      this.toSummary(row, row.memberships[0] ?? null, row._count.memberships),
    );
    const last = page[page.length - 1];
    return {
      groups,
      nextCursor:
        rows.length > limit && last
          ? encodeGroupCreatedCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async getDetail(viewer: User, groupId: string): Promise<GroupDetailDto> {
    assertGroupAccess(viewer);
    const row = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: {
        ...groupPublicSelect,
        memberships: {
          where: { userId: viewer.id },
          select: { status: true, role: true },
          take: 1,
        },
        _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      },
    });
    if (
      !row ||
      (!isDiscoverableGroupStatus(row.status) && row.memberships[0]?.status !== "ACTIVE")
    ) {
      throw groupNotFound();
    }
    const mine = row.memberships[0] ?? null;
    const summary = this.toSummary(row, mine, row._count.memberships);
    return {
      ...summary,
      canAccessContent: mine?.status === "ACTIVE",
    };
  }

  async listMine(
    viewer: User,
    query: MyGroupListQuery,
  ): Promise<{ groups: MyGroupDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);
    const limit = Math.min(query.limit ?? GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeGroupCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.communityMembership.findMany({
      where: {
        userId: viewer.id,
        status: query.status ?? { in: ["ACTIVE", "PENDING"] },
        ...(query.role ? { role: query.role } : {}),
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
        group: {
          select: {
            ...groupPublicSelect,
            _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
          },
        },
      },
    });

    const page = rows.slice(0, limit);
    const groups = page.map((row) => ({
      ...this.toSummary(row.group, row, row.group._count.memberships),
      role: row.status === "ACTIVE" ? row.role : null,
      membershipStatus: row.status,
    }));
    const last = page[page.length - 1];
    return {
      groups,
      nextCursor:
        rows.length > limit && last
          ? encodeGroupCreatedCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async create(viewer: User, input: CreateGroupInput): Promise<GroupDetailDto> {
    assertGroupAccess(viewer);
    const category = GROUP_CATEGORY_CATALOG.find((entry) => entry.slug === input.category);
    if (!category) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }

    const created = await this.db.$transaction(async (tx) => {
      const group = await tx.communityGroup.create({
        data: {
          ownerId: viewer.id,
          name: input.name,
          description: input.description ?? null,
          categoryId: category.id,
          locationCity: input.locationCity ?? null,
          locationRegion: input.locationRegion ?? null,
          privacy: input.privacy,
          meetupFrequency: input.meetupFrequency ?? null,
          memberCapacity: input.memberCapacity ?? null,
          tags: input.tags?.length ? { create: input.tags.map((tag) => ({ tag })) } : undefined,
        },
        select: groupPublicSelect,
      });
      await tx.communityMembership.create({
        data: {
          groupId: group.id,
          userId: viewer.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      return group;
    });

    return {
      ...this.toSummary(created, { status: "ACTIVE", role: "OWNER" }, 1),
      canAccessContent: true,
    };
  }

  async getManage(viewer: User, groupId: string): Promise<GroupManageDto> {
    assertGroupAccess(viewer);
    const membership = await loadMembership(this.db, groupId, viewer.id);
    if (
      !membership ||
      membership.status !== "ACTIVE" ||
      !["OWNER", "MODERATOR"].includes(membership.role)
    ) {
      throw groupNotFound();
    }
    const row = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: {
        ...groupPublicSelect,
        _count: {
          select: {
            memberships: { where: { status: "ACTIVE" } },
            posts: { where: { moderation: "VISIBLE" } },
          },
        },
      },
    });
    if (!row) {
      throw groupNotFound();
    }
    const pendingRequestCount = await this.db.communityMembership.count({
      where: { groupId, status: "PENDING" },
    });
    return {
      ...this.toSummary(row, membership, row._count.memberships),
      canAccessContent: true,
      pendingRequestCount,
      visiblePostCount: row._count.posts,
    };
  }

  async patch(viewer: User, groupId: string, input: PatchGroupInput): Promise<GroupDetailDto> {
    assertGroupAccess(viewer);
    const membership = await loadMembership(this.db, groupId, viewer.id);
    assertCanEditCore(membership?.status === "ACTIVE" ? membership.role : null);

    const restrictedTouched = input.privacy !== undefined || input.memberCapacity !== undefined;
    if (restrictedTouched) {
      assertCanEditRestricted(membership!.role);
    }

    const updated = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "CommunityGroup" WHERE "id" = ${groupId} FOR UPDATE`;
      const group = await tx.communityGroup.findUnique({
        where: { id: groupId },
        select: groupPublicSelect,
      });
      if (!group) {
        throw groupNotFound();
      }

      if (input.memberCapacity !== undefined && input.memberCapacity !== null) {
        const activeCount = await countActiveMembers(tx, groupId);
        if (!canDecreaseMemberCapacity(input.memberCapacity, activeCount)) {
          throw groupForbidden("Member capacity cannot be below the current active member count");
        }
      }

      let categoryId = group.categoryId;
      if (input.category) {
        const category = GROUP_CATEGORY_CATALOG.find((entry) => entry.slug === input.category);
        if (!category) {
          throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
        }
        categoryId = category.id;
      }

      if (input.tags) {
        await tx.communityGroupTag.deleteMany({ where: { groupId } });
        if (input.tags.length > 0) {
          await tx.communityGroupTag.createMany({
            data: input.tags.map((tag) => ({ groupId, tag })),
          });
        }
      }

      return tx.communityGroup.update({
        where: { id: groupId },
        data: {
          name: input.name,
          description: input.description === undefined ? undefined : input.description,
          categoryId,
          locationCity: input.locationCity === undefined ? undefined : input.locationCity,
          locationRegion: input.locationRegion === undefined ? undefined : input.locationRegion,
          privacy: input.privacy,
          meetupFrequency: input.meetupFrequency === undefined ? undefined : input.meetupFrequency,
          memberCapacity: input.memberCapacity === undefined ? undefined : input.memberCapacity,
        },
        select: groupPublicSelect,
      });
    });

    const activeCount = await countActiveMembers(this.db, groupId);
    return {
      ...this.toSummary(updated, membership, activeCount),
      canAccessContent: true,
    };
  }

  async uploadCover(
    viewer: User,
    groupId: string,
    file: Express.Multer.File | undefined,
  ): Promise<GroupDetailDto> {
    assertGroupAccess(viewer);
    if (!file?.buffer) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }
    const membership = await loadMembership(this.db, groupId, viewer.id);
    assertCanEditCore(membership?.status === "ACTIVE" ? membership.role : null);
    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { id: true, coverStorageKey: true },
    });
    if (!group) {
      throw groupNotFound();
    }

    const processed = await processAvatarUpload(file.buffer);
    const stored = await this.coverStorage.save(groupId, processed.buffer, processed.contentType);
    const previousKey = group.coverStorageKey;
    try {
      const updated = await this.db.communityGroup.update({
        where: { id: groupId },
        data: {
          coverStorageKey: stored.storageKey,
          coverContentType: processed.contentType,
        },
        select: groupPublicSelect,
      });
      if (previousKey && previousKey !== stored.storageKey) {
        await this.coverStorage.deleteByStorageKey(previousKey, groupId).catch(() => undefined);
      }
      const activeCount = await countActiveMembers(this.db, groupId);
      return {
        ...this.toSummary(updated, membership, activeCount),
        canAccessContent: true,
      };
    } catch (err) {
      await this.coverStorage.deleteByStorageKey(stored.storageKey, groupId).catch(() => undefined);
      throw err;
    }
  }

  async deleteCover(viewer: User, groupId: string): Promise<{ deleted: true }> {
    assertGroupAccess(viewer);
    const membership = await loadMembership(this.db, groupId, viewer.id);
    assertCanEditCore(membership?.status === "ACTIVE" ? membership.role : null);
    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { coverStorageKey: true },
    });
    if (!group) {
      throw groupNotFound();
    }
    if (group.coverStorageKey) {
      await this.coverStorage
        .deleteByStorageKey(group.coverStorageKey, groupId)
        .catch(() => undefined);
    }
    await this.db.communityGroup.update({
      where: { id: groupId },
      data: { coverStorageKey: null, coverContentType: null },
    });
    return { deleted: true };
  }

  async getCoverBytes(
    viewer: User,
    groupId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    assertGroupAccess(viewer);
    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        privacy: true,
        status: true,
        coverStorageKey: true,
        coverContentType: true,
      },
    });
    if (!group?.coverStorageKey || !group.coverContentType) {
      throw groupNotFound();
    }
    const membership = await loadMembership(this.db, groupId, viewer.id);
    const memberActive = membership?.status === "ACTIVE";
    if (!memberActive && !canNonMemberSeeCover({ privacy: group.privacy, status: group.status })) {
      throw groupNotFound();
    }
    const buffer = await this.coverStorage.readBytes(group.coverStorageKey, groupId);
    return { buffer, contentType: group.coverContentType };
  }

  private toSummary(
    row: GroupPublicRow,
    membership: {
      status: GroupViewerMembershipDto["status"];
      role: GroupViewerMembershipDto["role"];
    } | null,
    memberCount: number,
  ): GroupSummaryDto {
    return toGroupSummaryDto({
      groupId: row.id,
      name: row.name,
      description: row.description,
      category: categoryDto(row.category),
      tags: row.tags.map((item) => item.tag),
      locationCity: row.locationCity,
      locationRegion: row.locationRegion,
      privacy: row.privacy,
      meetupFrequency: row.meetupFrequency,
      memberCapacity: row.memberCapacity,
      memberCount,
      coverStorageKey: row.coverStorageKey,
      status: row.status,
      myMembership: membershipDto(membership),
    });
  }
}
