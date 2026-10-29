import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { hasFullAccountAccess, toPolicyActor } from "../policy/account-policy.js";
import {
  canViewPublicProfile,
  toDiscoverUserSnapshot,
  type DiscoverUserSnapshot,
} from "../policy/public-profile-policy.js";
import { SOCIAL_NOT_FOUND_MESSAGE } from "./social.constants.js";
import { canInitiateSocialContact, isSelfTarget } from "./social-policy.js";

export function socialNotFound(): AppError {
  return new AppError("NOT_FOUND", SOCIAL_NOT_FOUND_MESSAGE, 404);
}

export function socialForbidden(message = "Social action is not available"): AppError {
  return new AppError("AUTH_FORBIDDEN", message, 403);
}

export function assertFullAccess(user: User): void {
  if (!hasFullAccountAccess(toPolicyActor(user))) {
    throw new AppError(
      "AUTH_FORBIDDEN",
      "Social features are not available in the current account state",
      403,
    );
  }
}

const targetSelect = {
  id: true,
  accountStatus: true,
  emailVerifiedAt: true,
  ageEligibilityStatus: true,
  suspendedAt: true,
  deletedAt: true,
  identityVerificationStatus: true,
  identityVerificationApprovedAt: true,
  identityVerificationValidUntil: true,
  identityVerificationRevokedAt: true,
  identityVerificationSessionId: true,
  adminReviewStatus: true,
  adminReviewVerificationSessionId: true,
  createdAt: true,
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

export type SocialTargetRow = {
  id: string;
  accountStatus: User["accountStatus"];
  emailVerifiedAt: Date | null;
  ageEligibilityStatus: User["ageEligibilityStatus"];
  suspendedAt: Date | null;
  deletedAt: Date | null;
  identityVerificationStatus: User["identityVerificationStatus"];
  identityVerificationApprovedAt: Date | null;
  identityVerificationValidUntil: Date | null;
  identityVerificationRevokedAt: Date | null;
  identityVerificationSessionId: string | null;
  adminReviewStatus: User["adminReviewStatus"];
  adminReviewVerificationSessionId: string | null;
  createdAt: Date;
  profile: {
    displayName: string | null;
    username: string | null;
    avatarStorageKey: string | null;
    locationCity: string | null;
    locationRegion: string | null;
    profileVisibility: "EVERYONE" | "VERIFIED_USERS_ONLY";
  } | null;
};

export async function loadVisibleSocialTarget(
  db: DatabaseClient,
  viewer: User,
  targetUserId: string,
): Promise<{
  target: SocialTargetRow;
  targetSnapshot: DiscoverUserSnapshot;
  viewerSnapshot: DiscoverUserSnapshot;
  blocked: boolean;
}> {
  assertFullAccess(viewer);
  if (isSelfTarget(viewer.id, targetUserId)) {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: targetSelect,
  });
  if (!target?.profile) {
    throw socialNotFound();
  }

  const blocked = await isBlockedEitherDirection(db, viewer.id, targetUserId);
  const viewerSnapshot = toDiscoverUserSnapshot(viewer);
  const targetSnapshot = toDiscoverUserSnapshot(target);

  if (
    !canInitiateSocialContact(
      viewerSnapshot,
      targetSnapshot,
      target.profile.profileVisibility,
      blocked,
    )
  ) {
    throw socialNotFound();
  }

  return { target, targetSnapshot, viewerSnapshot, blocked };
}

export function targetSnapshotFromRow(row: SocialTargetRow): DiscoverUserSnapshot {
  return toDiscoverUserSnapshot(row);
}

export function canShowSocialPreview(
  viewer: DiscoverUserSnapshot,
  target: DiscoverUserSnapshot,
  visibility: "EVERYONE" | "VERIFIED_USERS_ONLY",
  blocked: boolean,
): boolean {
  return canViewPublicProfile(viewer, target, visibility, blocked);
}
