import type { UserNotificationType } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { canAccessAccount, toPolicyActor } from "../policy/account-policy.js";
import { assertMainAppHomeAccess } from "../policy/home-access-enforcement.js";

export type PushSkipReason =
  | "PUSH_DISABLED"
  | "STALE_NOTIFICATION"
  | "ACCOUNT_INELIGIBLE"
  | "PUSH_OPT_OUT"
  | "CATEGORY_DISABLED"
  | "NO_DEVICES";

const defaultPreference = {
  pushEnabled: true,
  directMessagesEnabled: true,
  messageRequestsEnabled: true,
  groupMembershipEnabled: true,
  groupChatEnabled: false,
  activityUpdatesEnabled: true,
  meetupInvitesEnabled: true,
  marketingEnabled: false,
};

export function notificationTypeAllowedByPreference(
  type: UserNotificationType,
  prefs: typeof defaultPreference,
): boolean {
  switch (type) {
    case "MESSAGE_REQUEST_RECEIVED":
    case "MESSAGE_REQUEST_ACCEPTED":
      return prefs.messageRequestsEnabled;
    case "DIRECT_MESSAGE_RECEIVED":
      return prefs.directMessagesEnabled;
    case "GROUP_MEMBERSHIP_APPROVED":
    case "GROUP_MEMBERSHIP_DECLINED":
      return prefs.groupMembershipEnabled;
    case "ACTIVITY_RSVP_CONFIRMED":
    case "ACTIVITY_RSVP_WAITLISTED":
    case "ACTIVITY_WAITLIST_PROMOTED":
      return prefs.activityUpdatesEnabled;
    case "MEETUP_INVITATION_RECEIVED":
    case "MEETUP_INVITATION_ACCEPTED":
    case "MEETUP_INVITATION_DECLINED":
    case "MEETUP_INVITATION_WITHDRAWN":
      return prefs.meetupInvitesEnabled;
    default:
      return false;
  }
}

export async function loadEligiblePushDevices(
  db: DatabaseClient,
  env: AppEnv,
  recipientId: string,
  notificationType: UserNotificationType,
): Promise<
  | { ok: true; devices: { id: string; registrationToken: string; sessionId: string | null }[] }
  | { ok: false; reason: PushSkipReason }
> {
  if (!env.PUSH_ENABLED) {
    return { ok: false, reason: "PUSH_DISABLED" };
  }

  const user = await db.user.findUnique({
    where: { id: recipientId },
    select: {
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
    },
  });
  if (!user || !canAccessAccount(toPolicyActor(user), recipientId)) {
    return { ok: false, reason: "ACCOUNT_INELIGIBLE" };
  }

  try {
    await assertMainAppHomeAccess(db, env, recipientId);
  } catch {
    return { ok: false, reason: "ACCOUNT_INELIGIBLE" };
  }

  const prefRow = await db.userNotificationPreference.findUnique({
    where: { userId: recipientId },
  });
  const prefs = prefRow
    ? {
        pushEnabled: prefRow.pushEnabled,
        directMessagesEnabled: prefRow.directMessagesEnabled,
        messageRequestsEnabled: prefRow.messageRequestsEnabled,
        groupMembershipEnabled: prefRow.groupMembershipEnabled,
        groupChatEnabled: prefRow.groupChatEnabled,
        activityUpdatesEnabled: prefRow.activityUpdatesEnabled,
        meetupInvitesEnabled: prefRow.meetupInvitesEnabled,
        marketingEnabled: prefRow.marketingEnabled,
      }
    : defaultPreference;

  if (!prefs.pushEnabled) {
    return { ok: false, reason: "PUSH_OPT_OUT" };
  }
  if (!notificationTypeAllowedByPreference(notificationType, prefs)) {
    return { ok: false, reason: "CATEGORY_DISABLED" };
  }

  const devices = await db.userDeviceToken.findMany({
    where: {
      userId: recipientId,
      revokedAt: null,
      OR: [
        { sessionId: null },
        {
          session: {
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      ],
    },
    select: {
      id: true,
      registrationToken: true,
      sessionId: true,
    },
  });

  if (devices.length === 0) {
    return { ok: false, reason: "NO_DEVICES" };
  }

  return { ok: true, devices };
}
