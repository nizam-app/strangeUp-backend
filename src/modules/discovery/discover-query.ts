import type { Prisma } from "../../../generated/prisma/client.js";
import { hasTrustedGovernmentIdKycApproved } from "../policy/public-profile-policy.js";
import type { DiscoverUserSnapshot } from "../policy/public-profile-policy.js";

export function buildDiscoverableUsersWhere(
  viewer: DiscoverUserSnapshot,
  filters: {
    q?: string;
    city?: string;
    region?: string;
    interestSlug?: string;
    cursor?: { createdAt: Date; id: string };
  },
): Prisma.UserWhereInput {
  const viewerKycApproved = hasTrustedGovernmentIdKycApproved(viewer);

  const visibilityOr: Prisma.ProfileWhereInput[] = [{ profileVisibility: "EVERYONE" }];
  if (viewerKycApproved) {
    visibilityOr.push({ profileVisibility: "VERIFIED_USERS_ONLY" });
  }

  const profileAnd: Prisma.ProfileWhereInput[] = [{ OR: visibilityOr }];

  if (filters.city) {
    profileAnd.push({ locationCity: { equals: filters.city, mode: "insensitive" } });
  }
  if (filters.region) {
    profileAnd.push({ locationRegion: { equals: filters.region, mode: "insensitive" } });
  }
  if (filters.q) {
    profileAnd.push({
      OR: [
        { displayName: { contains: filters.q, mode: "insensitive" } },
        { username: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.UserWhereInput = {
    id: { not: viewer.userId },
    accountStatus: "ACTIVE",
    emailVerifiedAt: { not: null },
    ageEligibilityStatus: "ELIGIBLE",
    suspendedAt: null,
    deletedAt: null,
    profile: { is: { AND: profileAnd } },
    blocksInitiated: { none: { blockedId: viewer.userId } },
    blocksReceived: { none: { blockerId: viewer.userId } },
  };

  if (filters.interestSlug) {
    where.userInterests = {
      some: { interest: { slug: filters.interestSlug } },
    };
  }

  if (filters.cursor) {
    where.AND = [
      {
        OR: [
          { createdAt: { gt: filters.cursor.createdAt } },
          {
            createdAt: filters.cursor.createdAt,
            id: { gt: filters.cursor.id },
          },
        ],
      },
    ];
  }

  return where;
}
