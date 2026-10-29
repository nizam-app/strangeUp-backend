import type { Prisma } from "../../../generated/prisma/client.js";
import type { GroupListQuery, MyGroupListQuery } from "./group.validation.js";

export function buildDiscoverableGroupsWhere(input: {
  query: GroupListQuery;
  cursor?: { createdAt: Date; id: string };
}): Prisma.CommunityGroupWhereInput {
  const where: Prisma.CommunityGroupWhereInput = {
    status: "ACTIVE",
    owner: {
      accountStatus: "ACTIVE",
      emailVerifiedAt: { not: null },
      ageEligibilityStatus: "ELIGIBLE",
      suspendedAt: null,
      deletedAt: null,
    },
  };

  if (input.query.q) {
    where.name = { contains: input.query.q, mode: "insensitive" };
  }
  if (input.query.category) {
    where.category = { slug: input.query.category };
  }
  if (input.query.city) {
    where.locationCity = { equals: input.query.city, mode: "insensitive" };
  }
  if (input.query.region) {
    where.locationRegion = { equals: input.query.region, mode: "insensitive" };
  }
  if (input.query.privacy) {
    where.privacy = input.query.privacy;
  }
  if (input.query.tag) {
    where.tags = { some: { tag: input.query.tag } };
  }
  if (input.cursor) {
    where.AND = [
      {
        OR: [
          { createdAt: { lt: input.cursor.createdAt } },
          {
            AND: [{ createdAt: input.cursor.createdAt }, { id: { lt: input.cursor.id } }],
          },
        ],
      },
    ];
  }

  return where;
}

function myGroupsNameFilter(q: string | undefined): Prisma.CommunityMembershipWhereInput {
  if (!q) {
    return {};
  }
  return {
    group: { name: { contains: q, mode: "insensitive" } },
  };
}

/** Membership rows for GET /v1/me/groups (Task 012 + 029B inventory views). */
export function buildMyMembershipWhere(input: {
  userId: string;
  query: MyGroupListQuery;
}): Prisma.CommunityMembershipWhereInput {
  const base: Prisma.CommunityMembershipWhereInput = {
    userId: input.userId,
    ...myGroupsNameFilter(input.query.q),
  };

  const view = input.query.view;
  if (view === "pending") {
    return { ...base, status: "PENDING" };
  }
  if (view === "joined") {
    return { ...base, status: "ACTIVE", role: "MEMBER" };
  }
  if (view === "managed") {
    return { ...base, status: "ACTIVE", role: { in: ["OWNER", "MODERATOR"] } };
  }
  if (view === "all") {
    return { ...base, status: { in: ["ACTIVE", "PENDING"] } };
  }

  return {
    ...base,
    status: input.query.status ?? { in: ["ACTIVE", "PENDING"] },
    ...(input.query.role ? { role: input.query.role } : {}),
  };
}
