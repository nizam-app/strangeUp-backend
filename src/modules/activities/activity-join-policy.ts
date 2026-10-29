import type {
  ActivityJoinMode,
  ActivityParticipationState,
} from "../../../generated/prisma/client.js";

/** WAITLISTED rows eligible for FIFO promotion (AUTO instant waitlist or host-approved waitlist). */
export function isWaitlistFifoEligible(input: {
  joinMode: ActivityJoinMode;
  hostApprovedAt: Date | null;
}): boolean {
  if (input.joinMode === "AUTO") {
    return true;
  }
  return input.hostApprovedAt !== null;
}

export function isActiveHostApprovalRequest(state: ActivityParticipationState): boolean {
  return state === "PENDING";
}

export function canApplicantSubmitJoinRequest(existingState: ActivityParticipationState | null): {
  allowed: boolean;
  reason?: "duplicate_active" | "declined_reapply_unresolved";
} {
  if (!existingState || existingState === "CANCELLED") {
    return { allowed: true };
  }
  if (existingState === "DECLINED") {
    return { allowed: false, reason: "declined_reapply_unresolved" };
  }
  return { allowed: false, reason: "duplicate_active" };
}

export type ParticipationPresentation = {
  joinMode: ActivityJoinMode;
  state: Exclude<ActivityParticipationState, "CANCELLED">;
  waitlistPosition: number | null;
  hostApprovedAt: string | null;
  requestedAt: string;
  /** Server-authoritative label for Flutter (distinct from capacity waitlist). */
  participationStatus:
    | "AUTO_CONFIRMED"
    | "AUTO_WAITLISTED"
    | "APPROVAL_PENDING"
    | "APPROVAL_DECLINED"
    | "APPROVAL_CONFIRMED"
    | "APPROVAL_WAITLISTED";
};

export function toParticipationPresentation(input: {
  joinMode: ActivityJoinMode;
  state: ActivityParticipationState;
  waitlistPosition: number | null;
  hostApprovedAt: Date | null;
  joinedAt: Date;
}): ParticipationPresentation | null {
  if (input.state === "CANCELLED") {
    return null;
  }
  const requestedAt = input.joinedAt.toISOString();
  const hostApprovedAt = input.hostApprovedAt?.toISOString() ?? null;

  if (input.joinMode === "AUTO") {
    if (input.state === "CONFIRMED") {
      return {
        joinMode: input.joinMode,
        state: input.state,
        waitlistPosition: null,
        hostApprovedAt,
        requestedAt,
        participationStatus: "AUTO_CONFIRMED",
      };
    }
    if (input.state === "WAITLISTED") {
      return {
        joinMode: input.joinMode,
        state: input.state,
        waitlistPosition: input.waitlistPosition,
        hostApprovedAt,
        requestedAt,
        participationStatus: "AUTO_WAITLISTED",
      };
    }
    return null;
  }

  if (input.state === "PENDING") {
    return {
      joinMode: input.joinMode,
      state: input.state,
      waitlistPosition: null,
      hostApprovedAt,
      requestedAt,
      participationStatus: "APPROVAL_PENDING",
    };
  }
  if (input.state === "DECLINED") {
    return {
      joinMode: input.joinMode,
      state: input.state,
      waitlistPosition: null,
      hostApprovedAt,
      requestedAt,
      participationStatus: "APPROVAL_DECLINED",
    };
  }
  if (input.state === "CONFIRMED") {
    return {
      joinMode: input.joinMode,
      state: input.state,
      waitlistPosition: null,
      hostApprovedAt,
      requestedAt,
      participationStatus: "APPROVAL_CONFIRMED",
    };
  }
  if (input.state === "WAITLISTED") {
    return {
      joinMode: input.joinMode,
      state: input.state,
      waitlistPosition: input.waitlistPosition,
      hostApprovedAt,
      requestedAt,
      participationStatus: "APPROVAL_WAITLISTED",
    };
  }
  return null;
}
