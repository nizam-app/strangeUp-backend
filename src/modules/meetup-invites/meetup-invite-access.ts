import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import {
  hasHomeAccess,
  toActivationPolicyActor,
} from "../policy/effective-access-policy.js";
import type { KycEnforcementContext } from "../verification/kyc-trust.js";
import { loadVisibleSocialTarget } from "../social/social-access.js";
import { MEETUP_INVITE_NOT_FOUND_MESSAGE } from "./meetup-invite.constants.js";
import {
  canAccessMeetupInviteAsParticipant,
  type MeetupInviteActorContext,
} from "./meetup-invite-policy.js";
import { MEETUP_INVITE_PARTICIPANTS_INELIGIBLE_MESSAGE } from "./meetup-invite-transition-errors.js";

export const meetupInviteParticipantActivationSelect = {
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
} as const;

export function meetupInviteNotFound(): AppError {
  return new AppError("NOT_FOUND", MEETUP_INVITE_NOT_FOUND_MESSAGE, 404);
}

export async function loadMeetupInviteRecipientForCreate(
  db: DatabaseClient,
  sender: User,
  recipientUserId: string,
) {
  return loadVisibleSocialTarget(db, sender, recipientUserId);
}

export async function assertMeetupInviteReadable(
  db: DatabaseClient,
  viewer: User,
  invite: { id: string; senderId: string; recipientId: string },
): Promise<MeetupInviteActorContext> {
  const ctx: MeetupInviteActorContext = {
    viewerUserId: viewer.id,
    senderId: invite.senderId,
    recipientId: invite.recipientId,
  };
  if (!canAccessMeetupInviteAsParticipant(ctx)) {
    throw meetupInviteNotFound();
  }
  const otherId = viewer.id === invite.senderId ? invite.recipientId : invite.senderId;
  if (await isBlockedEitherDirection(db, viewer.id, otherId)) {
    throw meetupInviteNotFound();
  }
  return ctx;
}

/** Task 022 activation for both parties at mutation time (D-28). */
export async function assertMeetupInviteParticipantsEligible(
  db: DatabaseClient,
  senderId: string,
  recipientId: string,
  kyc: KycEnforcementContext,
): Promise<void> {
  const users = await db.user.findMany({
    where: { id: { in: [senderId, recipientId] } },
    select: meetupInviteParticipantActivationSelect,
  });
  if (users.length !== 2) {
    throw meetupInviteNotFound();
  }
  for (const user of users) {
    if (!hasHomeAccess(toActivationPolicyActor(user), kyc)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        MEETUP_INVITE_PARTICIPANTS_INELIGIBLE_MESSAGE,
        403,
      );
    }
  }
}
