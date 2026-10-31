import type { PersonalMeetupInviteStatus } from "../../../generated/prisma/client.js";
import type {
  MeetupInviteMutationAction,
  MeetupInviteParticipantRole,
} from "./meetup-invite.types.js";
import { MEETUP_INVITE_TERMINAL_STATUSES } from "./meetup-invite.types.js";

export type MeetupInviteTransitionDecision =
  | { kind: "apply"; nextStatus: PersonalMeetupInviteStatus }
  | { kind: "noop"; status: PersonalMeetupInviteStatus }
  | { kind: "reject"; reason: MeetupInviteTransitionRejectReason };

export type MeetupInviteTransitionRejectReason =
  | "wrong_actor"
  | "not_pending"
  | "not_expirable"
  | "already_terminal"
  | "pending_not_yet_due_for_expiry";

/** Lazy expiry: PENDING past scheduledStartsAt is treated as EXPIRED for policy reads (028C — no worker). */
export function resolveEffectiveMeetupInviteStatus(
  storedStatus: PersonalMeetupInviteStatus,
  scheduledStartsAt: Date,
  now: Date = new Date(),
): PersonalMeetupInviteStatus {
  if (storedStatus !== "PENDING") {
    return storedStatus;
  }
  if (scheduledStartsAt.getTime() <= now.getTime()) {
    return "EXPIRED";
  }
  return "PENDING";
}

export function isMeetupInviteTerminalStatus(status: PersonalMeetupInviteStatus): boolean {
  return MEETUP_INVITE_TERMINAL_STATUSES.has(status);
}

export function decideMeetupInviteTransition(input: {
  action: MeetupInviteMutationAction;
  actorRole: MeetupInviteParticipantRole;
  storedStatus: PersonalMeetupInviteStatus;
  scheduledStartsAt: Date;
  now?: Date;
}): MeetupInviteTransitionDecision {
  const now = input.now ?? new Date();
  const effective = resolveEffectiveMeetupInviteStatus(
    input.storedStatus,
    input.scheduledStartsAt,
    now,
  );

  if (input.action === "accept") {
    if (input.actorRole !== "recipient") {
      return { kind: "reject", reason: "wrong_actor" };
    }
    if (input.storedStatus === "ACCEPTED") {
      return { kind: "noop", status: "ACCEPTED" };
    }
    if (effective !== "PENDING") {
      return {
        kind: "reject",
        reason: effective === "EXPIRED" ? "not_pending" : "already_terminal",
      };
    }
    return { kind: "apply", nextStatus: "ACCEPTED" };
  }

  if (input.action === "decline") {
    if (input.actorRole !== "recipient") {
      return { kind: "reject", reason: "wrong_actor" };
    }
    if (input.storedStatus === "DECLINED") {
      return { kind: "noop", status: "DECLINED" };
    }
    if (effective !== "PENDING") {
      return {
        kind: "reject",
        reason: effective === "EXPIRED" ? "not_pending" : "already_terminal",
      };
    }
    return { kind: "apply", nextStatus: "DECLINED" };
  }

  if (input.action === "withdraw") {
    if (input.actorRole !== "sender") {
      return { kind: "reject", reason: "wrong_actor" };
    }
    if (input.storedStatus === "WITHDRAWN") {
      return { kind: "noop", status: "WITHDRAWN" };
    }
    if (effective !== "PENDING") {
      return {
        kind: "reject",
        reason: effective === "EXPIRED" ? "not_pending" : "already_terminal",
      };
    }
    return { kind: "apply", nextStatus: "WITHDRAWN" };
  }

  // expire — system/lazy persistence (028D+); policy-only in 028C
  if (input.action === "expire") {
    if (input.storedStatus !== "PENDING") {
      return { kind: "reject", reason: "not_expirable" };
    }
    if (scheduledStartsAtAfter(now, input.scheduledStartsAt)) {
      return { kind: "reject", reason: "pending_not_yet_due_for_expiry" };
    }
    return { kind: "apply", nextStatus: "EXPIRED" };
  }

  return { kind: "reject", reason: "already_terminal" };
}

function scheduledStartsAtAfter(now: Date, scheduledStartsAt: Date): boolean {
  return scheduledStartsAt.getTime() > now.getTime();
}

/** Allowed stored transitions for persistence layers (excludes lazy effective EXPIRED until written). */
export const MEETUP_INVITE_STORED_TRANSITIONS: Readonly<
  Record<PersonalMeetupInviteStatus, ReadonlySet<PersonalMeetupInviteStatus>>
> = {
  PENDING: new Set(["ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"]),
  ACCEPTED: new Set(),
  DECLINED: new Set(),
  WITHDRAWN: new Set(),
  EXPIRED: new Set(),
};

export function isAllowedStoredMeetupInviteTransition(
  from: PersonalMeetupInviteStatus,
  to: PersonalMeetupInviteStatus,
): boolean {
  return MEETUP_INVITE_STORED_TRANSITIONS[from].has(to);
}
