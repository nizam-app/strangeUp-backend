import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { canAccessAccount, toPolicyActor } from "../policy/account-policy.js";
import { assertMainAppHomeAccess } from "../policy/home-access-enforcement.js";

const accountSelect = {
  id: true,
  accountStatus: true,
  suspendedAt: true,
  deletedAt: true,
  emailVerifiedAt: true,
  ageEligibilityStatus: true,
  identityVerificationStatus: true,
  identityVerificationApprovedAt: true,
  identityVerificationValidUntil: true,
  identityVerificationRevokedAt: true,
  identityVerificationSessionId: true,
  adminReviewStatus: true,
  adminReviewVerificationSessionId: true,
} as const;

/** Session validity + Task 022 home access + non-suspended active account. */
export async function assertMessagingSocketEligible(
  db: DatabaseClient,
  env: AppEnv,
  sessionId: string,
  userId: string,
): Promise<void> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: { revokedAt: true, expiresAt: true, userId: true },
  });
  if (
    !session ||
    session.userId !== userId ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date()
  ) {
    throw new AppError("AUTH_UNAUTHORIZED", "Session is no longer valid", 401);
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: accountSelect,
  });
  if (!user || !canAccessAccount(toPolicyActor(user), userId)) {
    throw new AppError("AUTH_FORBIDDEN", "Account is not eligible for realtime messaging", 403);
  }

  await assertMainAppHomeAccess(db, env, userId);
}

export async function isUserEligibleForMessagingSummary(
  db: DatabaseClient,
  env: AppEnv,
  userId: string,
): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: accountSelect,
    });
    if (!user || !canAccessAccount(toPolicyActor(user), userId)) {
      return false;
    }
    await assertMainAppHomeAccess(db, env, userId);
    return true;
  } catch {
    return false;
  }
}
