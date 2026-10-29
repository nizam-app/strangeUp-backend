import type {
  CommunityGroup,
  CommunityMembership,
  CommunityMembershipRole,
  User,
} from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { hasFullAccountAccess, toPolicyActor } from "../policy/account-policy.js";
import { groupForbidden, groupNotFound } from "./group-errors.js";
import type { CommunityGroupStatus } from "../../../generated/prisma/client.js";
import {
  canAccessGroupContent,
  canApproveMembership,
  canArchiveGroup,
  canEditCoreGroupFields,
  canEditRestrictedGroupFields,
  canPinOrModerateContent,
  canTransferOwnership,
  isManagerRole,
} from "./group-policy.js";

export function assertGroupActiveForMutation(status: CommunityGroupStatus): void {
  if (status !== "ACTIVE") {
    throw groupForbidden("This group is archived");
  }
}

export function assertGroupAccess(user: User): void {
  if (!hasFullAccountAccess(toPolicyActor(user))) {
    throw new AppError(
      "AUTH_FORBIDDEN",
      "Group features are not available in the current account state",
      403,
    );
  }
}

export const groupPublicSelect = {
  id: true,
  ownerId: true,
  name: true,
  description: true,
  categoryId: true,
  locationCity: true,
  locationRegion: true,
  privacy: true,
  meetupFrequency: true,
  memberCapacity: true,
  status: true,
  coverStorageKey: true,
  coverContentType: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { slug: true, label: true } },
  tags: { select: { tag: true }, orderBy: { tag: "asc" as const } },
} as const;

export const membershipUserSelect = {
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
} as const;

export type GroupPublicRow = Pick<
  CommunityGroup,
  | "id"
  | "ownerId"
  | "name"
  | "description"
  | "categoryId"
  | "locationCity"
  | "locationRegion"
  | "privacy"
  | "meetupFrequency"
  | "memberCapacity"
  | "status"
  | "coverStorageKey"
  | "coverContentType"
  | "createdAt"
  | "updatedAt"
> & {
  category: { slug: string; label: string };
  tags: { tag: string }[];
};

export async function countActiveMembers(
  db: Pick<DatabaseClient, "communityMembership">,
  groupId: string,
): Promise<number> {
  return db.communityMembership.count({
    where: { groupId, status: "ACTIVE" },
  });
}

export async function loadMembership(
  db: Pick<DatabaseClient, "communityMembership">,
  groupId: string,
  userId: string,
): Promise<CommunityMembership | null> {
  return db.communityMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

export function requireActiveMember(membership: CommunityMembership | null): CommunityMembership {
  if (!membership || membership.status !== "ACTIVE") {
    throw groupNotFound();
  }
  return membership;
}

export function requireManager(membership: CommunityMembership | null): CommunityMembership {
  const active = requireActiveMember(membership);
  if (!isManagerRole(active.role)) {
    throw groupNotFound();
  }
  return active;
}

export function requireOwner(membership: CommunityMembership | null): CommunityMembership {
  const active = requireActiveMember(membership);
  if (active.role !== "OWNER") {
    throw groupNotFound();
  }
  return active;
}

export function assertCanApprove(role: CommunityMembershipRole | null): void {
  if (!canApproveMembership(role)) {
    throw groupNotFound();
  }
}

export function assertCanEditCore(role: CommunityMembershipRole | null): void {
  if (!canEditCoreGroupFields(role)) {
    throw groupNotFound();
  }
}

export function assertCanEditRestricted(role: CommunityMembershipRole | null): void {
  if (!canEditRestrictedGroupFields(role)) {
    throw groupForbidden("Only the group owner can change this setting");
  }
}

export function assertCanArchive(role: CommunityMembershipRole | null): void {
  if (!canArchiveGroup(role)) {
    throw groupNotFound();
  }
}

export function assertCanTransfer(role: CommunityMembershipRole | null): void {
  if (!canTransferOwnership(role)) {
    throw groupNotFound();
  }
}

export function assertCanModerateContent(role: CommunityMembershipRole | null): void {
  if (!canPinOrModerateContent(role)) {
    throw groupNotFound();
  }
}

export function assertCanReadContent(membership: CommunityMembership | null): void {
  if (
    !canAccessGroupContent({ groupStatus: "ACTIVE", membershipStatus: membership?.status ?? null })
  ) {
    throw groupNotFound();
  }
}
