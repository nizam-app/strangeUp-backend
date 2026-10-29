import { AppError } from "../../common/errors/app-error.js";
import type { MeetupInviteTransitionRejectReason } from "./meetup-invite-state.js";

export const MEETUP_INVITE_MUTATION_FORBIDDEN_MESSAGE =
  "Not allowed to perform this action on this invitation";

export const MEETUP_INVITE_NOT_ACTIONABLE_MESSAGE = "Meetup invitation is not actionable";

export const MEETUP_INVITE_PARTICIPANTS_INELIGIBLE_MESSAGE =
  "Meetup invitation can no longer be completed";

export function meetupInviteTransitionError(
  reason: MeetupInviteTransitionRejectReason,
): AppError {
  switch (reason) {
    case "wrong_actor":
      return new AppError("AUTH_FORBIDDEN", MEETUP_INVITE_MUTATION_FORBIDDEN_MESSAGE, 403);
    case "not_pending":
    case "already_terminal":
    case "not_expirable":
    case "pending_not_yet_due_for_expiry":
      return new AppError("CONFLICT", MEETUP_INVITE_NOT_ACTIONABLE_MESSAGE, 409);
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}
