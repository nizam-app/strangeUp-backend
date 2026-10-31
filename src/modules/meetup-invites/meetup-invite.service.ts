import { Prisma, type User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { hasTrustedKycForActivityAction } from "../activities/activity-policy.js";
import {
  toKycTrustSnapshot,
  type ActivityKycEnforcementContext,
} from "../activities/activity-kyc.js";
import { loadBlockedPeerIds } from "../blocks/block-access.js";
import { decodeSocialCreatedCursor, encodeSocialCreatedCursor } from "../social/social-cursor.js";
import {
  assertMeetupInviteParticipantsEligible,
  assertMeetupInviteReadable,
  loadMeetupInviteRecipientForCreate,
  meetupInviteNotFound,
} from "./meetup-invite-access.js";
import {
  MEETUP_INVITE_LIST_DEFAULT_LIMIT,
  MEETUP_INVITE_LIST_MAX_LIMIT,
} from "./meetup-invite.constants.js";
import type { MeetupInviteDetailDto, MeetupInviteListResponseDto } from "./meetup-invite.dto.js";
import {
  reconcileLazyExpiredMeetupInviteById,
  reconcileLazyExpiredMeetupInvitesForUser,
} from "./meetup-invite-expiry.js";
import {
  hashMeetupInviteCreatePayload,
  scopeMeetupInviteCreateIdempotencyKey,
  type MeetupInviteCreatePayloadFingerprint,
} from "./meetup-invite-idempotency.js";
import { toMeetupInviteDetailDto, toMeetupInviteListItemDto } from "./meetup-invite.mapper.js";
import {
  canCreateMeetupInviteGivenExistingPending,
  evaluateMeetupInviteMutation,
} from "./meetup-invite-policy.js";
import { meetupInviteTransitionError } from "./meetup-invite-transition-errors.js";
import type { MeetupInviteMutationAction } from "./meetup-invite.types.js";
import { NotificationEmitter } from "../notifications/notification-emitter.service.js";
import {
  emitMeetupInviteCreatedNotification,
  emitMeetupInviteTransitionNotification,
} from "./meetup-invite-notifications.js";
import { validateMeetupInviteCreateFields } from "./meetup-invite-validation.js";
import type { CreateMeetupInviteBody, MeetupInviteListQuery } from "./meetup-invite.validation.js";

const inviteInclude = {
  sender: { select: { id: true, profile: { select: { displayName: true, username: true } } } },
  recipient: { select: { id: true, profile: { select: { displayName: true, username: true } } } },
} as const;

export class MeetupInviteService {
  private readonly notifications: NotificationEmitter;

  constructor(
    private readonly db: DatabaseClient,
    private readonly kyc: ActivityKycEnforcementContext,
    notifications?: NotificationEmitter,
  ) {
    this.notifications = notifications ?? new NotificationEmitter(db);
  }

  private assertSenderKyc(sender: User): void {
    if (!hasTrustedKycForActivityAction(toKycTrustSnapshot(sender), this.kyc)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Identity verification is required before sending meetup invitations",
        403,
      );
    }
  }

  private assertRecipientKyc(recipient: User): void {
    if (!hasTrustedKycForActivityAction(toKycTrustSnapshot(recipient), this.kyc)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Identity verification is required before accepting meetup invitations",
        403,
      );
    }
  }

  private mutationTimestampFields(
    action: MeetupInviteMutationAction,
    now: Date,
  ): Pick<
    Prisma.PersonalMeetupInvitationUpdateManyMutationInput,
    "acceptedAt" | "declinedAt" | "withdrawnAt"
  > {
    switch (action) {
      case "accept":
        return { acceptedAt: now };
      case "decline":
        return { declinedAt: now };
      case "withdraw":
        return { withdrawnAt: now };
      default:
        return {};
    }
  }

  private buildCreateFingerprint(
    body: CreateMeetupInviteBody,
  ): MeetupInviteCreatePayloadFingerprint {
    return {
      recipientUserId: body.recipientUserId,
      meetupType: body.meetupType,
      title: body.title.trim(),
      scheduledStartsAt: body.scheduledStartsAt,
      scheduleTimeZone: body.scheduleTimeZone,
      venueCity: body.venue.city.trim(),
      venueRegion: body.venue.region.trim(),
      venueLabel: body.venue.label ?? null,
      venueAddressLine: body.venue.addressLine ?? null,
      venuePlaceNotes: body.venue.placeNotes ?? null,
      note: body.note ?? null,
    };
  }

  async create(
    sender: User,
    body: CreateMeetupInviteBody,
    idempotencyHeaderKey: string | undefined,
  ): Promise<{ dto: MeetupInviteDetailDto; created: boolean }> {
    this.assertSenderKyc(sender);
    await loadMeetupInviteRecipientForCreate(this.db, sender, body.recipientUserId);

    const scheduledStartsAt = new Date(body.scheduledStartsAt);
    const fieldValidation = validateMeetupInviteCreateFields({
      senderUserId: sender.id,
      recipientUserId: body.recipientUserId,
      title: body.title,
      note: body.note,
      scheduledStartsAt,
      scheduleTimeZone: body.scheduleTimeZone,
      venueCity: body.venue.city,
      venueRegion: body.venue.region,
      venueLabel: body.venue.label,
      venueAddressLine: body.venue.addressLine,
      venuePlaceNotes: body.venue.placeNotes,
    });
    if (!fieldValidation.ok) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }

    const fingerprint = this.buildCreateFingerprint(body);
    const payloadHash = hashMeetupInviteCreatePayload(fingerprint);

    let scopedIdempotencyKey: string | undefined;
    if (idempotencyHeaderKey?.trim()) {
      scopedIdempotencyKey = scopeMeetupInviteCreateIdempotencyKey(sender.id, idempotencyHeaderKey);
      const existing = await this.db.personalMeetupInvitation.findUnique({
        where: { createIdempotencyKey: scopedIdempotencyKey },
        include: inviteInclude,
      });
      if (existing) {
        if (existing.senderId !== sender.id) {
          throw new AppError("CONFLICT", "Idempotency key conflict", 409);
        }
        const existingHash = hashMeetupInviteCreatePayload({
          recipientUserId: existing.recipientId,
          meetupType: existing.meetupType,
          title: existing.title,
          scheduledStartsAt: existing.scheduledStartsAt.toISOString(),
          scheduleTimeZone: existing.scheduleTimeZone,
          venueCity: existing.venueCity,
          venueRegion: existing.venueRegion,
          venueLabel: existing.venueLabel,
          venueAddressLine: existing.venueAddressLine,
          venuePlaceNotes: existing.venuePlaceNotes,
          note: existing.note,
        });
        if (existingHash !== payloadHash) {
          throw new AppError("CONFLICT", "Idempotency key reused with different payload", 409);
        }
        await assertMeetupInviteReadable(this.db, sender, existing);
        await reconcileLazyExpiredMeetupInviteById(this.db, existing.id);
        const refreshed = await this.db.personalMeetupInvitation.findUniqueOrThrow({
          where: { id: existing.id },
          include: inviteInclude,
        });
        return {
          dto: toMeetupInviteDetailDto(refreshed, sender.id),
          created: false,
        };
      }
    }

    const pendingExists = await this.db.personalMeetupInvitation.findFirst({
      where: {
        senderId: sender.id,
        recipientId: body.recipientUserId,
        status: "PENDING",
        scheduledStartsAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!canCreateMeetupInviteGivenExistingPending(pendingExists !== null)) {
      throw new AppError(
        "CONFLICT",
        "A pending meetup invitation already exists for this recipient",
        409,
      );
    }

    try {
      const row = await this.db.$transaction(async (tx) => {
        const created = await tx.personalMeetupInvitation.create({
          data: {
            senderId: sender.id,
            recipientId: body.recipientUserId,
            status: "PENDING",
            meetupType: body.meetupType,
            title: body.title.trim(),
            scheduledStartsAt,
            scheduleTimeZone: body.scheduleTimeZone,
            venueCity: body.venue.city.trim(),
            venueRegion: body.venue.region.trim(),
            venueLabel: body.venue.label ?? null,
            venueAddressLine: body.venue.addressLine ?? null,
            venuePlaceNotes: body.venue.placeNotes ?? null,
            note: body.note ?? null,
            createIdempotencyKey: scopedIdempotencyKey ?? null,
          },
          include: inviteInclude,
        });
        await emitMeetupInviteCreatedNotification(
          tx,
          this.notifications,
          {
            inviteId: created.id,
            senderId: created.senderId,
            recipientId: created.recipientId,
          },
          this.kyc,
        );
        return created;
      });
      return { dto: toMeetupInviteDetailDto(row, sender.id), created: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(
          "CONFLICT",
          "A pending meetup invitation already exists for this recipient",
          409,
        );
      }
      throw err;
    }
  }

  async list(viewer: User, query: MeetupInviteListQuery): Promise<MeetupInviteListResponseDto> {
    const now = new Date();
    await reconcileLazyExpiredMeetupInvitesForUser(this.db, viewer.id, now);

    const box = query.box ?? "incoming";
    const statusFilter = query.status ?? "pending";
    const limit = Math.min(
      query.limit ?? MEETUP_INVITE_LIST_DEFAULT_LIMIT,
      MEETUP_INVITE_LIST_MAX_LIMIT,
    );

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeSocialCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const blockedPeers = [...(await loadBlockedPeerIds(this.db, viewer.id))];
    const blockFilter: Prisma.PersonalMeetupInvitationWhereInput =
      blockedPeers.length > 0
        ? {
            senderId: { notIn: blockedPeers },
            recipientId: { notIn: blockedPeers },
          }
        : {};

    const whereBase: Prisma.PersonalMeetupInvitationWhereInput = {
      ...(box === "incoming" ? { recipientId: viewer.id } : { senderId: viewer.id }),
      ...blockFilter,
    };

    const statusWhere = this.buildStatusWhere(statusFilter, now);
    const where: Prisma.PersonalMeetupInvitationWhereInput = {
      ...whereBase,
      ...statusWhere,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
            ],
          }
        : {}),
    };

    const rows = await this.db.personalMeetupInvitation.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: inviteInclude,
    });

    const page = rows.length > limit ? rows.slice(0, limit) : rows;
    const lastRow = page.at(-1);
    const nextCursor =
      rows.length > limit && lastRow
        ? encodeSocialCreatedCursor({
            createdAt: lastRow.createdAt.toISOString(),
            id: lastRow.id,
          })
        : null;

    const pendingCount =
      box === "incoming"
        ? await this.db.personalMeetupInvitation.count({
            where: {
              recipientId: viewer.id,
              status: "PENDING",
              scheduledStartsAt: { gt: now },
              ...blockFilter,
            },
          })
        : 0;

    return {
      invites: page.map((row) => toMeetupInviteListItemDto(row, viewer.id, now)),
      nextCursor,
      counts: { pending: pendingCount },
    };
  }

  private buildStatusWhere(
    status: NonNullable<MeetupInviteListQuery["status"]>,
    now: Date,
  ): Prisma.PersonalMeetupInvitationWhereInput {
    switch (status) {
      case "pending":
        return { status: "PENDING", scheduledStartsAt: { gt: now } };
      case "accepted":
        return { status: "ACCEPTED" };
      case "declined":
        return { status: "DECLINED" };
      case "withdrawn":
        return { status: "WITHDRAWN" };
      case "expired":
        return {
          OR: [{ status: "EXPIRED" }, { status: "PENDING", scheduledStartsAt: { lte: now } }],
        };
      case "all":
        return {};
      default:
        return { status: "PENDING", scheduledStartsAt: { gt: now } };
    }
  }

  async getById(viewer: User, inviteId: string): Promise<MeetupInviteDetailDto> {
    await reconcileLazyExpiredMeetupInviteById(this.db, inviteId);
    const row = await this.db.personalMeetupInvitation.findUnique({
      where: { id: inviteId },
      include: inviteInclude,
    });
    if (!row) {
      throw meetupInviteNotFound();
    }
    await assertMeetupInviteReadable(this.db, viewer, row);
    return toMeetupInviteDetailDto(row, viewer.id);
  }

  async accept(viewer: User, inviteId: string): Promise<MeetupInviteDetailDto> {
    return this.mutateInvite(viewer, inviteId, "accept");
  }

  async decline(viewer: User, inviteId: string): Promise<MeetupInviteDetailDto> {
    return this.mutateInvite(viewer, inviteId, "decline");
  }

  async withdraw(viewer: User, inviteId: string): Promise<MeetupInviteDetailDto> {
    return this.mutateInvite(viewer, inviteId, "withdraw");
  }

  private async mutateInvite(
    viewer: User,
    inviteId: string,
    action: MeetupInviteMutationAction,
  ): Promise<MeetupInviteDetailDto> {
    const now = new Date();
    await reconcileLazyExpiredMeetupInviteById(this.db, inviteId, now);

    const row = await this.db.personalMeetupInvitation.findUnique({
      where: { id: inviteId },
      include: inviteInclude,
    });
    if (!row) {
      throw meetupInviteNotFound();
    }

    const ctx = await assertMeetupInviteReadable(this.db, viewer, row);
    await assertMeetupInviteParticipantsEligible(this.db, row.senderId, row.recipientId, this.kyc);

    if (action === "accept") {
      this.assertRecipientKyc(viewer);
    }

    const preDecision = evaluateMeetupInviteMutation({
      action,
      ctx,
      storedStatus: row.status,
      scheduledStartsAt: row.scheduledStartsAt,
      now,
    });
    if (preDecision.kind === "noop") {
      return toMeetupInviteDetailDto(row, viewer.id, now);
    }
    if (preDecision.kind === "reject") {
      throw meetupInviteTransitionError(preDecision.reason);
    }

    const updated = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "PersonalMeetupInvitation" WHERE "id" = ${inviteId} FOR UPDATE`;

      await reconcileLazyExpiredMeetupInviteById(tx, inviteId, now);

      const locked = await tx.personalMeetupInvitation.findUnique({
        where: { id: inviteId },
        include: inviteInclude,
      });
      if (!locked) {
        throw meetupInviteNotFound();
      }

      const decision = evaluateMeetupInviteMutation({
        action,
        ctx,
        storedStatus: locked.status,
        scheduledStartsAt: locked.scheduledStartsAt,
        now,
      });
      if (decision.kind === "noop") {
        return locked;
      }
      if (decision.kind === "reject") {
        throw meetupInviteTransitionError(decision.reason);
      }

      const applyResult = await tx.personalMeetupInvitation.updateMany({
        where: {
          id: inviteId,
          status: "PENDING",
          scheduledStartsAt: { gt: now },
        },
        data: {
          status: decision.nextStatus,
          ...this.mutationTimestampFields(action, now),
        },
      });

      if (applyResult.count === 0) {
        await reconcileLazyExpiredMeetupInviteById(tx, inviteId, now);
        const after = await tx.personalMeetupInvitation.findUnique({
          where: { id: inviteId },
          include: inviteInclude,
        });
        if (!after) {
          throw meetupInviteNotFound();
        }
        const afterDecision = evaluateMeetupInviteMutation({
          action,
          ctx,
          storedStatus: after.status,
          scheduledStartsAt: after.scheduledStartsAt,
          now,
        });
        if (afterDecision.kind === "noop") {
          return after;
        }
        throw meetupInviteTransitionError(
          afterDecision.kind === "reject" ? afterDecision.reason : "already_terminal",
        );
      }

      const applied = await tx.personalMeetupInvitation.findUniqueOrThrow({
        where: { id: inviteId },
        include: inviteInclude,
      });
      await emitMeetupInviteTransitionNotification(
        tx,
        this.notifications,
        action,
        applied,
        this.kyc,
      );
      return applied;
    });

    return toMeetupInviteDetailDto(updated, viewer.id, now);
  }
}
