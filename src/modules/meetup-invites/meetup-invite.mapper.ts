import type { PersonalMeetupInvitation, Profile } from "../../../generated/prisma/client.js";
import { resolveEffectiveMeetupInviteStatus } from "./meetup-invite-state.js";
import {
  meetupInviteActionAvailability,
  resolveMeetupInviteParticipantRole,
  type MeetupInviteActorContext,
} from "./meetup-invite-policy.js";
import type { MeetupInviteDetailDto, MeetupInviteListItemDto } from "./meetup-invite.dto.js";
import {
  redactMeetupInviteVenueForListCard,
  redactMeetupInviteVenueForViewer,
} from "./meetup-invite-venue-redaction.js";

type InviteRow = PersonalMeetupInvitation & {
  sender: { id: string; profile: Pick<Profile, "displayName" | "username"> | null };
  recipient: { id: string; profile: Pick<Profile, "displayName" | "username"> | null };
};

function counterpartyFromRow(row: InviteRow, viewerUserId: string) {
  const isSender = viewerUserId === row.senderId;
  const peer = isSender ? row.recipient : row.sender;
  return {
    userId: peer.id,
    displayName: peer.profile?.displayName ?? null,
    username: peer.profile?.username ?? null,
  };
}

function storedVenue(row: InviteRow) {
  return {
    venueCity: row.venueCity,
    venueRegion: row.venueRegion,
    venueLabel: row.venueLabel,
    venueAddressLine: row.venueAddressLine,
    venuePlaceNotes: row.venuePlaceNotes,
  };
}

export function toMeetupInviteListItemDto(
  row: InviteRow,
  viewerUserId: string,
  now: Date = new Date(),
): MeetupInviteListItemDto {
  const ctx: MeetupInviteActorContext = {
    viewerUserId,
    senderId: row.senderId,
    recipientId: row.recipientId,
  };
  const viewerRole = resolveMeetupInviteParticipantRole(ctx)!;
  const effectiveStatus = resolveEffectiveMeetupInviteStatus(
    row.status,
    row.scheduledStartsAt,
    now,
  );

  return {
    id: row.id,
    status: effectiveStatus,
    meetupType: row.meetupType,
    title: row.title,
    scheduledStartsAt: row.scheduledStartsAt.toISOString(),
    scheduleTimeZone: row.scheduleTimeZone,
    venue: redactMeetupInviteVenueForListCard(storedVenue(row)),
    counterparty: counterpartyFromRow(row, viewerUserId),
    viewerRole,
    createdAt: row.createdAt.toISOString(),
    actions: meetupInviteActionAvailability({
      ctx,
      storedStatus: row.status,
      scheduledStartsAt: row.scheduledStartsAt,
      now,
    }),
  };
}

export function toMeetupInviteDetailDto(
  row: InviteRow,
  viewerUserId: string,
  now: Date = new Date(),
): MeetupInviteDetailDto {
  const list = toMeetupInviteListItemDto(row, viewerUserId, now);
  const ctx: MeetupInviteActorContext = {
    viewerUserId,
    senderId: row.senderId,
    recipientId: row.recipientId,
  };
  const viewerRole = resolveMeetupInviteParticipantRole(ctx)!;

  return {
    ...list,
    venue: redactMeetupInviteVenueForViewer({
      venue: storedVenue(row),
      viewerRole,
      storedStatus: row.status,
      scheduledStartsAt: row.scheduledStartsAt,
      now,
    }),
    note: row.note,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    declinedAt: row.declinedAt?.toISOString() ?? null,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    expiredAt: row.expiredAt?.toISOString() ?? null,
  };
}
