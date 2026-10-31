import type { Prisma, UserNotificationType } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { hasHomeAccess, toActivationPolicyActor } from "../policy/effective-access-policy.js";
import type { KycEnforcementContext } from "../verification/kyc-trust.js";
import { NotificationEmitter } from "../notifications/notification-emitter.service.js";
import { meetupInviteParticipantActivationSelect } from "./meetup-invite-access.js";
import type { MeetupInviteMutationAction } from "./meetup-invite.types.js";

type DbLike = DatabaseClient | Prisma.TransactionClient;

export const MEETUP_INVITE_NOTIFICATION_COPY = {
  MEETUP_INVITATION_RECEIVED: {
    title: "Meetup invitation",
    body: "You have a new meetup invitation. Open StrangeUp to respond.",
  },
  MEETUP_INVITATION_ACCEPTED: {
    title: "Meetup invitation accepted",
    body: "Your meetup invitation was accepted. Open StrangeUp for details.",
  },
  MEETUP_INVITATION_DECLINED: {
    title: "Meetup invitation declined",
    body: "Your meetup invitation was declined. Open StrangeUp for details.",
  },
  MEETUP_INVITATION_WITHDRAWN: {
    title: "Meetup invitation withdrawn",
    body: "A meetup invitation was withdrawn. Open StrangeUp for details.",
  },
} as const satisfies Record<
  | "MEETUP_INVITATION_RECEIVED"
  | "MEETUP_INVITATION_ACCEPTED"
  | "MEETUP_INVITATION_DECLINED"
  | "MEETUP_INVITATION_WITHDRAWN",
  { title: string; body: string }
>;

export function meetupInviteNotificationDedupeKey(
  inviteId: string,
  event: "received" | "accepted" | "declined" | "withdrawn",
): string {
  return `meetup-invite:${inviteId}:${event}`;
}

/** Task 022 + block gate before persisting notification (skip silently if ineligible). */
export async function canDeliverMeetupInviteNotification(
  db: DbLike,
  recipientId: string,
  peerUserId: string,
  kyc: KycEnforcementContext,
): Promise<boolean> {
  if (await isBlockedEitherDirection(db, recipientId, peerUserId)) {
    return false;
  }
  const user = await db.user.findUnique({
    where: { id: recipientId },
    select: meetupInviteParticipantActivationSelect,
  });
  if (!user) {
    return false;
  }
  return hasHomeAccess(toActivationPolicyActor(user), kyc);
}

async function emitMeetupNotification(
  tx: Prisma.TransactionClient,
  notifications: NotificationEmitter,
  input: {
    recipientId: string;
    peerUserId: string;
    inviteId: string;
    type: UserNotificationType;
    dedupeKey: string;
    kyc: KycEnforcementContext;
  },
): Promise<void> {
  const deliver = await canDeliverMeetupInviteNotification(
    tx,
    input.recipientId,
    input.peerUserId,
    input.kyc,
  );
  if (!deliver) {
    return;
  }
  const copy =
    MEETUP_INVITE_NOTIFICATION_COPY[input.type as keyof typeof MEETUP_INVITE_NOTIFICATION_COPY];
  await notifications.emitInTransaction(tx, {
    recipientId: input.recipientId,
    type: input.type,
    actorUserId: null,
    sourceId: input.inviteId,
    title: copy.title,
    body: copy.body,
    dedupeKey: input.dedupeKey,
  });
}

export async function emitMeetupInviteCreatedNotification(
  tx: Prisma.TransactionClient,
  notifications: NotificationEmitter,
  input: { inviteId: string; senderId: string; recipientId: string },
  kyc: KycEnforcementContext,
): Promise<void> {
  await emitMeetupNotification(tx, notifications, {
    recipientId: input.recipientId,
    peerUserId: input.senderId,
    inviteId: input.inviteId,
    type: "MEETUP_INVITATION_RECEIVED",
    dedupeKey: meetupInviteNotificationDedupeKey(input.inviteId, "received"),
    kyc,
  });
}

export async function emitMeetupInviteTransitionNotification(
  tx: Prisma.TransactionClient,
  notifications: NotificationEmitter,
  action: MeetupInviteMutationAction,
  invite: { id: string; senderId: string; recipientId: string },
  kyc: KycEnforcementContext,
): Promise<void> {
  switch (action) {
    case "accept":
      await emitMeetupNotification(tx, notifications, {
        recipientId: invite.senderId,
        peerUserId: invite.recipientId,
        inviteId: invite.id,
        type: "MEETUP_INVITATION_ACCEPTED",
        dedupeKey: meetupInviteNotificationDedupeKey(invite.id, "accepted"),
        kyc,
      });
      break;
    case "decline":
      await emitMeetupNotification(tx, notifications, {
        recipientId: invite.senderId,
        peerUserId: invite.recipientId,
        inviteId: invite.id,
        type: "MEETUP_INVITATION_DECLINED",
        dedupeKey: meetupInviteNotificationDedupeKey(invite.id, "declined"),
        kyc,
      });
      break;
    case "withdraw":
      await emitMeetupNotification(tx, notifications, {
        recipientId: invite.recipientId,
        peerUserId: invite.senderId,
        inviteId: invite.id,
        type: "MEETUP_INVITATION_WITHDRAWN",
        dedupeKey: meetupInviteNotificationDedupeKey(invite.id, "withdrawn"),
        kyc,
      });
      break;
    default:
      break;
  }
}
