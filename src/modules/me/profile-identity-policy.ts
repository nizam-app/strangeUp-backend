import type { User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import {
  hasTrustedKycForEnforcement,
  toKycTrustSnapshot,
  type KycEnforcementContext,
  type KycTrustSnapshot,
} from "../verification/kyc-trust.js";

/** Legal first/last name are bound to provider KYC once trusted approval exists (Task 025D). */
export function isLegalNameLockedFromSnapshot(
  snapshot: KycTrustSnapshot,
  ctx: KycEnforcementContext,
  now: Date = new Date(),
): boolean {
  if (hasTrustedKycForEnforcement(snapshot, ctx, now)) {
    return true;
  }
  // Sticky binding (Task 025E): do not unlock when enforcement lapses (expiry/revocation/suspension).
  if (snapshot.identityVerificationApprovedAt != null) {
    return true;
  }
  if (snapshot.identityVerificationRevokedAt != null) {
    return true;
  }
  return false;
}

/** @deprecated Prefer resolveLegalNameLocked for API paths; sync helper for unit tests. */
export function isLegalNameLocked(
  user: Pick<
    User,
    | "identityVerificationStatus"
    | "identityVerificationApprovedAt"
    | "identityVerificationValidUntil"
    | "identityVerificationRevokedAt"
  >,
  ctx: KycEnforcementContext,
  now: Date = new Date(),
): boolean {
  return isLegalNameLockedFromSnapshot(toKycTrustSnapshot(user), ctx, now);
}

/**
 * Full legal-name lock including staff identity approval audit (survives provider EXPIRED
 * webhook clearing denormalized user KYC fields).
 */
export async function resolveLegalNameLocked(
  db: DatabaseClient,
  user: Pick<
    User,
    | "id"
    | "identityVerificationStatus"
    | "identityVerificationApprovedAt"
    | "identityVerificationValidUntil"
    | "identityVerificationRevokedAt"
  >,
  ctx: KycEnforcementContext,
  now: Date = new Date(),
): Promise<boolean> {
  if (isLegalNameLockedFromSnapshot(toKycTrustSnapshot(user), ctx, now)) {
    return true;
  }
  const priorStaffApproval = await db.identityAdminReviewDecision.findFirst({
    where: { userId: user.id, status: "APPROVED" },
    select: { id: true },
  });
  return priorStaffApproval != null;
}

export function profilePatchTouchesLegalName(input: {
  firstName?: string;
  lastName?: string;
}): boolean {
  return input.firstName !== undefined || input.lastName !== undefined;
}
