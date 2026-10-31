import type { PersonalMeetupInviteStatus } from "../../../generated/prisma/client.js";
import type {
  MeetupInviteMutationAction,
  MeetupInviteParticipantRole,
} from "./meetup-invite.types.js";
import {
  decideMeetupInviteTransition,
  resolveEffectiveMeetupInviteStatus,
} from "./meetup-invite-state.js";

export type MeetupInviteActorContext = {
  viewerUserId: string;
  senderId: string;
  recipientId: string;
};

export function resolveMeetupInviteParticipantRole(
  ctx: MeetupInviteActorContext,
): MeetupInviteParticipantRole | null {
  if (ctx.viewerUserId === ctx.senderId) {
    return "sender";
  }
  if (ctx.viewerUserId === ctx.recipientId) {
    return "recipient";
  }
  return null;
}

/** Only sender or recipient may access invite payloads (HTTP layer returns 404 for null). */
export function canAccessMeetupInviteAsParticipant(ctx: MeetupInviteActorContext): boolean {
  return resolveMeetupInviteParticipantRole(ctx) !== null;
}

export function canSenderCreateMeetupInviteWhenBlocked(blockedEitherDirection: boolean): boolean {
  return !blockedEitherDirection;
}

/**
 * One active PENDING invite per ordered (senderId, recipientId) pair — DB partial unique index.
 * Application may create a new row once prior invite is terminal.
 */
export function canCreateMeetupInviteGivenExistingPending(
  hasPendingForOrderedPair: boolean,
): boolean {
  return !hasPendingForOrderedPair;
}

export type MeetupInviteActionAvailability = {
  canAccept: boolean;
  canDecline: boolean;
  canWithdraw: boolean;
};

export function meetupInviteActionAvailability(input: {
  ctx: MeetupInviteActorContext;
  storedStatus: PersonalMeetupInviteStatus;
  scheduledStartsAt: Date;
  now?: Date;
}): MeetupInviteActionAvailability {
  const role = resolveMeetupInviteParticipantRole(input.ctx);
  const effective = resolveEffectiveMeetupInviteStatus(
    input.storedStatus,
    input.scheduledStartsAt,
    input.now,
  );

  if (effective !== "PENDING" || role === null) {
    return { canAccept: false, canDecline: false, canWithdraw: false };
  }

  return {
    canAccept: role === "recipient",
    canDecline: role === "recipient",
    canWithdraw: role === "sender",
  };
}

export function evaluateMeetupInviteMutation(input: {
  action: MeetupInviteMutationAction;
  ctx: MeetupInviteActorContext;
  storedStatus: PersonalMeetupInviteStatus;
  scheduledStartsAt: Date;
  now?: Date;
}) {
  const role = resolveMeetupInviteParticipantRole(input.ctx);
  if (role === null) {
    return { kind: "reject" as const, reason: "wrong_actor" as const };
  }
  return decideMeetupInviteTransition({
    action: input.action,
    actorRole: role,
    storedStatus: input.storedStatus,
    scheduledStartsAt: input.scheduledStartsAt,
    now: input.now,
  });
}

/**
 * Historical rows remain when eligibility is lost; HTTP/services must deny reads/mutations
 * via activation/block checks (028D) without deleting invite records.
 */
export const MEETUP_INVITE_RETENTION = {
  deleteOnUserDeletion: false,
  foreignKeyOnDelete: "Restrict" as const,
  hideOnBlock: true,
  denyMutationWhenIneligible: true,
} as const;
