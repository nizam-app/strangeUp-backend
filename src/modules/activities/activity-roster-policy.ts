import type { ActivityParticipationState } from "../../../generated/prisma/client.js";

/** Conservative ACT-ROSTER: host (manage-eligible) or currently CONFIRMED participant only. */
export function canViewActivityConfirmedRoster(input: {
  isHost: boolean;
  hostCanManage: boolean;
  viewerParticipationState: ActivityParticipationState | null;
}): boolean {
  if (input.isHost && input.hostCanManage) {
    return true;
  }
  return input.viewerParticipationState === "CONFIRMED";
}
