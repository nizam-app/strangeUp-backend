import type { Prisma } from "../../../generated/prisma/client.js";
import type { ActivityListQuery } from "./activity.validation.js";

export function buildDiscoverableActivitiesWhere(input: {
  now: Date;
  blockedHostIds: string[];
  query: ActivityListQuery;
  cursor?: { startsAt: Date; id: string };
}): Prisma.ActivityWhereInput {
  const startsAtFilter: Prisma.DateTimeFilter = {};
  if (input.query.startsAfter) {
    startsAtFilter.gte = new Date(input.query.startsAfter);
  } else {
    startsAtFilter.gte = input.now;
  }
  if (input.query.startsBefore) {
    startsAtFilter.lte = new Date(input.query.startsBefore);
  }

  const where: Prisma.ActivityWhereInput = {
    status: "PUBLISHED",
    audience: "PUBLIC",
    startsAt: startsAtFilter,
    host: {
      accountStatus: "ACTIVE",
      emailVerifiedAt: { not: null },
      ageEligibilityStatus: "ELIGIBLE",
      suspendedAt: null,
      deletedAt: null,
    },
  };

  if (input.blockedHostIds.length > 0) {
    where.hostId = { notIn: input.blockedHostIds };
  }
  if (input.query.q) {
    where.title = { contains: input.query.q, mode: "insensitive" };
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
  if (input.query.mode) {
    where.mode = input.query.mode;
  }
  if (input.cursor) {
    where.AND = [
      {
        OR: [
          { startsAt: { gt: input.cursor.startsAt } },
          {
            AND: [{ startsAt: input.cursor.startsAt }, { id: { gt: input.cursor.id } }],
          },
        ],
      },
    ];
  }

  return where;
}
