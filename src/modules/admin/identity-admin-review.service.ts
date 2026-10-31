import { randomUUID } from "node:crypto";
import { Prisma, type User } from "../../../generated/prisma/client.js";
import { AppError, type AppErrorCode } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { buildConsentRegistryContext } from "../consent/consent-context.js";
import { userRegistrationConsentsSatisfyRegistry } from "../consent/canonical-consent-registry.js";
import {
  hasTrustedKycForEnforcement,
  type KycEnforcementContext,
} from "../verification/kyc-trust.js";
import { buildKycEnforcementContext } from "../verification/kyc-identity-authority.js";
import { resolveVerificationRuntimeConfig } from "../verification/verification-config.js";
import { isAdminIdentityReviewRejectReasonCode } from "./admin-review-reason-codes.js";
import type { AvatarStorage } from "../profile-media/local-avatar-storage.js";
import {
  profileHasAvatar,
  resolveIdentityReviewDisplayName,
  resolveStaffAuthorDisplayLabel,
} from "./identity-review-profile.js";
import {
  buildFilterFingerprint,
  buildIdentityReviewListWhere,
  decodeListCursor,
  encodeListCursor,
  parseSubmittedDateRange,
  type IdentityReviewListFilters,
} from "./identity-admin-review-list-query.js";
import { resolveIdentityReviewListPresentation } from "./identity-admin-review-list-presenter.js";
import {
  manualIdentityReviewPendingCriteria,
  platformPendingAdminQueueCriteria,
} from "./identity-admin-review-pending-eligibility.js";
import {
  assertNotSelfReview,
  assertNotesAllowedForStatus,
  assertQueueSessionBinding,
} from "./identity-admin-review-queue-policy.js";
import {
  decodeDecisionsCursor,
  encodeDecisionsCursor,
} from "./identity-admin-review-decisions-cursor.js";
import { decodeNotesCursor, encodeNotesCursor } from "./identity-admin-review-notes-cursor.js";
import type { PendingQueuePosture } from "./identity-admin-review-queue-policy.js";
import {
  assertIdempotencyDecisionMatchesRequest,
  assertNoCrossContextClientHeaderReuse,
  parseIdentityAdminReviewClientKeyHeader,
  prepareIdentityAdminReviewIdempotency,
  resolveStoredIdentityAdminReviewIdempotencyKey,
  type IdentityAdminReviewIdempotencyAction,
  type IdentityAdminReviewPreparedIdempotency,
} from "./identity-admin-review-idempotency.js";
import {
  resolveIdentityAdminReviewIdempotencyReservation,
  throwIdempotencyReservationConflict,
  throwIdempotencyReservationInProgress,
  toIdempotentReplayResponse,
} from "./identity-admin-review-idempotency-reservation.js";
import {
  buildIdentityReviewExportCsv,
  buildIdentityReviewExportFilename,
  IDENTITY_REVIEW_EXPORT_MAX_ROWS,
  type IdentityReviewExportCsvRow,
} from "./identity-admin-review-export-csv.js";
import {
  buildBatchBindingFingerprint,
  deriveBatchItemIdempotencyKey,
  mapBatchItemError,
  type IdentityReviewBatchDecideBody,
} from "./identity-admin-review-batch.js";

type IdentityReviewMutationReplay = {
  reviewId: string;
  adminReviewStatus: User["adminReviewStatus"];
  idempotentReplay: true;
};

type IdentityReviewMutationTx = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];

export type IdentityReviewListStatus = "PENDING" | "APPROVED" | "REJECTED";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return "***";
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function buildKycCtx(env: AppEnv): KycEnforcementContext {
  return buildKycEnforcementContext(env);
}

export class IdentityAdminReviewService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
    private readonly avatarStorage?: AvatarStorage,
  ) {}

  async getReviewSummary() {
    const platformQueue = platformPendingAdminQueueCriteria();
    const [platformActionable, platformOnHold, manualIdentityActionable, approved, rejected] =
      await Promise.all([
        this.db.user.count({
          where: {
            adminReviewStatus: "PENDING",
            ...platformQueue,
          },
        }),
        this.db.user.count({
          where: {
            adminReviewStatus: "NEEDS_FURTHER_REVIEW",
            ...platformQueue,
          },
        }),
        this.db.user.count({
          where: manualIdentityReviewPendingCriteria(),
        }),
        this.db.user.count({ where: { adminReviewStatus: "APPROVED" } }),
        this.db.user.count({ where: { adminReviewStatus: "REJECTED" } }),
      ]);
    const pendingActionable = platformActionable + manualIdentityActionable;
    const pendingOnHold = platformOnHold;
    const pendingTotal = pendingActionable + pendingOnHold;

    return {
      scope: "GLOBAL_STATUS_TOTALS" as const,
      pending: pendingTotal,
      pendingActionable,
      pendingOnHold,
      pendingTotal,
      approved,
      rejected,
    };
  }

  async listReviews(input: {
    status: IdentityReviewListStatus;
    posture?: PendingQueuePosture;
    limit: number;
    cursor?: string;
    q?: string;
    submittedFrom?: string;
    submittedTo?: string;
    identityVerificationStatus?: IdentityReviewListFilters["identityVerificationStatus"];
  }) {
    const take = input.limit + 1;
    const range = parseSubmittedDateRange(input.submittedFrom, input.submittedTo);
    const filters: IdentityReviewListFilters = {
      status: input.status,
      posture: input.status === "PENDING" ? (input.posture ?? "all") : undefined,
      q: input.q,
      submittedFrom: input.submittedFrom,
      submittedTo: input.submittedTo,
      identityVerificationStatus: input.identityVerificationStatus,
    };
    const filterFingerprint = buildFilterFingerprint(filters, range);
    const cursor = decodeListCursor(input.cursor, filterFingerprint);

    const baseWhere = buildIdentityReviewListWhere(filters, range);
    const andParts = Array.isArray(baseWhere.AND) ? [...baseWhere.AND] : [baseWhere];
    if (cursor) {
      andParts.push({
        OR: [
          { updatedAt: { lt: cursor.updatedAt } },
          {
            AND: [{ updatedAt: cursor.updatedAt }, { id: { lt: cursor.userId } }],
          },
        ],
      });
    }

    const rows = await this.db.user.findMany({
      where: { AND: andParts },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take,
      select: {
        id: true,
        email: true,
        createdAt: true,
        accountStatus: true,
        emailVerifiedAt: true,
        ageEligibilityStatus: true,
        identityVerificationStatus: true,
        adminReviewStatus: true,
        identityVerificationSessionId: true,
        adminReviewVerificationSessionId: true,
        adminReviewDecidedAt: true,
        updatedAt: true,
        profile: {
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
            avatarStorageKey: true,
          },
        },
      },
    });

    const page = rows.slice(0, input.limit);
    const nextCursor =
      rows.length > input.limit && page.length > 0
        ? encodeListCursor({
            updatedAt: page[page.length - 1].updatedAt,
            userId: page[page.length - 1].id,
            filterFingerprint,
          })
        : null;

    const sessionIds = [
      ...new Set(
        page
          .map((row) => row.identityVerificationSessionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const sessions =
      sessionIds.length > 0
        ? await this.db.verificationSession.findMany({
            where: { id: { in: sessionIds } },
            select: {
              id: true,
              provider: true,
              status: true,
              completedAt: true,
              updatedAt: true,
            },
          })
        : [];
    const sessionById = new Map(sessions.map((session) => [session.id, session]));

    return {
      reviews: page.map((row) => {
        const sessionId = row.identityVerificationSessionId;
        const session = sessionId ? (sessionById.get(sessionId) ?? null) : null;
        const presentation = resolveIdentityReviewListPresentation({
          adminReviewStatus: row.adminReviewStatus,
          session: session
            ? {
                provider: session.provider,
                status: session.status,
                completedAt: session.completedAt,
                updatedAt: session.updatedAt,
              }
            : null,
        });
        return {
          reviewId: row.id,
          displayName: resolveIdentityReviewDisplayName(row.profile),
          maskedEmail: maskEmail(row.email),
          hasAvatar: profileHasAvatar(row.profile),
          submittedAt: presentation.submittedAt?.toISOString() ?? null,
          accountStatus: row.accountStatus,
          emailVerified: row.emailVerifiedAt !== null,
          ageEligibilityStatus: row.ageEligibilityStatus,
          identityVerificationStatus: row.identityVerificationStatus,
          adminReviewStatus: row.adminReviewStatus,
          verificationSessionId: row.identityVerificationSessionId,
          adminReviewDecidedAt: row.adminReviewDecidedAt?.toISOString() ?? null,
          pendingReviewStage: presentation.pendingReviewStage,
          pendingReviewLabel: presentation.pendingReviewLabel,
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
      nextCursor,
    };
  }

  async exportReviewsCsv(input: {
    status: IdentityReviewListStatus;
    posture?: PendingQueuePosture;
    q?: string;
    submittedFrom?: string;
    submittedTo?: string;
    identityVerificationStatus?: IdentityReviewListFilters["identityVerificationStatus"];
  }) {
    const range = parseSubmittedDateRange(input.submittedFrom, input.submittedTo);
    const filters: IdentityReviewListFilters = {
      status: input.status,
      posture: input.status === "PENDING" ? (input.posture ?? "all") : undefined,
      q: input.q,
      submittedFrom: input.submittedFrom,
      submittedTo: input.submittedTo,
      identityVerificationStatus: input.identityVerificationStatus,
    };
    const filterDigest = buildFilterFingerprint(filters, range);
    const baseWhere = buildIdentityReviewListWhere(filters, range);

    const rows = await this.db.user.findMany({
      where: baseWhere,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: IDENTITY_REVIEW_EXPORT_MAX_ROWS + 1,
      select: {
        id: true,
        email: true,
        createdAt: true,
        ageEligibilityStatus: true,
        identityVerificationStatus: true,
        adminReviewStatus: true,
        identityVerificationSessionId: true,
        profile: {
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
            avatarStorageKey: true,
          },
        },
      },
    });

    const truncated = rows.length > IDENTITY_REVIEW_EXPORT_MAX_ROWS;
    const page = rows.slice(0, IDENTITY_REVIEW_EXPORT_MAX_ROWS);

    const sessionIds = [
      ...new Set(
        page
          .map((row) => row.identityVerificationSessionId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const sessions =
      sessionIds.length > 0
        ? await this.db.verificationSession.findMany({
            where: { id: { in: sessionIds } },
            select: {
              id: true,
              provider: true,
              status: true,
              completedAt: true,
              updatedAt: true,
            },
          })
        : [];
    const sessionById = new Map(sessions.map((session) => [session.id, session]));

    const csvRows: IdentityReviewExportCsvRow[] = page.map((row) => {
      const sessionId = row.identityVerificationSessionId;
      const session = sessionId ? (sessionById.get(sessionId) ?? null) : null;
      const presentation = resolveIdentityReviewListPresentation({
        adminReviewStatus: row.adminReviewStatus,
        session: session
          ? {
              provider: session.provider,
              status: session.status,
              completedAt: session.completedAt,
              updatedAt: session.updatedAt,
            }
          : null,
      });
      return {
        review_id: row.id,
        display_name: resolveIdentityReviewDisplayName(row.profile) ?? "",
        masked_email: maskEmail(row.email),
        admin_review_status: row.adminReviewStatus,
        identity_verification_status: row.identityVerificationStatus,
        age_eligibility_status: row.ageEligibilityStatus,
        provider_completed_at: presentation.submittedAt?.toISOString() ?? "",
        account_created_at: row.createdAt.toISOString(),
      };
    });

    const csv = buildIdentityReviewExportCsv({ rows: csvRows, truncated });
    const filename = buildIdentityReviewExportFilename(input.status);

    return {
      csv,
      filename,
      rowCount: csvRows.length,
      truncated,
      maxRows: IDENTITY_REVIEW_EXPORT_MAX_ROWS,
      filterDigest,
    };
  }

  async batchDecideReviews(input: { reviewer: User; body: IdentityReviewBatchDecideBody }) {
    const bindingFingerprint = buildBatchBindingFingerprint({
      action: input.body.action,
      reasonCode: input.body.reasonCode,
      reviewIds: input.body.reviewIds,
    });

    const results: Array<{
      reviewId: string;
      outcome: string;
      adminReviewStatus?: string;
      errorCode?: string;
      message?: string;
      idempotentReplay?: boolean;
    }> = [];

    for (const reviewId of input.body.reviewIds) {
      const idempotencyKey = deriveBatchItemIdempotencyKey({
        batchRequestId: input.body.batchRequestId,
        bindingFingerprint,
        reviewId,
      });

      try {
        const decision =
          input.body.action === "APPROVE"
            ? await this.approveReview({
                reviewer: input.reviewer,
                reviewId,
                idempotencyKey,
              })
            : await this.rejectReview({
                reviewer: input.reviewer,
                reviewId,
                reasonCode: input.body.reasonCode!,
                idempotencyKey,
              });

        results.push({
          reviewId: decision.reviewId,
          outcome: "SUCCEEDED",
          adminReviewStatus: decision.adminReviewStatus,
          idempotentReplay: decision.idempotentReplay ?? false,
        });
      } catch (err) {
        const mapped = mapBatchItemError(err);
        results.push({
          reviewId,
          outcome: mapped.outcome,
          errorCode: mapped.outcome,
          message: mapped.message,
        });
      }
    }

    const succeeded = results.filter((r) => r.outcome === "SUCCEEDED").length;
    const failed = results.length - succeeded;

    return {
      batchRequestId: input.body.batchRequestId,
      action: input.body.action,
      bindingFingerprint,
      totalSelected: results.length,
      succeeded,
      failed,
      partialSuccess: failed > 0 && succeeded > 0,
      allSucceeded: failed === 0,
      allFailed: succeeded === 0,
      results,
    };
  }

  async getReviewDetail(reviewId: string) {
    const user = await this.db.user.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        accountStatus: true,
        emailVerifiedAt: true,
        ageEligibilityStatus: true,
        identityVerificationStatus: true,
        identityVerificationApprovedAt: true,
        identityVerificationValidUntil: true,
        identityVerificationRevokedAt: true,
        identityVerificationSessionId: true,
        adminReviewStatus: true,
        adminReviewVerificationSessionId: true,
        adminReviewDecidedAt: true,
        suspendedAt: true,
        deletedAt: true,
        updatedAt: true,
        profile: {
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
            avatarStorageKey: true,
            locationCity: true,
            locationRegion: true,
          },
        },
      },
    });
    if (!user) {
      throw new AppError("NOT_FOUND", "Identity review not found", 404);
    }

    const session = user.identityVerificationSessionId
      ? await this.db.verificationSession.findFirst({
          where: { id: user.identityVerificationSessionId, userId: user.id },
          select: {
            id: true,
            status: true,
            provider: true,
            completedAt: true,
            sessionExpiresAt: true,
            updatedAt: true,
          },
        })
      : null;

    const recentDecisions = await this.db.identityAdminReviewDecision.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        reasonCode: true,
        verificationSessionId: true,
        reviewerUserId: true,
        createdAt: true,
      },
    });

    const submittedAt = session?.completedAt?.toISOString() ?? null;

    return {
      reviewId: user.id,
      displayName: resolveIdentityReviewDisplayName(user.profile),
      maskedEmail: maskEmail(user.email),
      hasAvatar: profileHasAvatar(user.profile),
      submittedAt,
      accountCreatedAt: user.createdAt.toISOString(),
      profileSummary: {
        displayName: resolveIdentityReviewDisplayName(user.profile),
        locationCity: user.profile?.locationCity ?? null,
        locationRegion: user.profile?.locationRegion ?? null,
      },
      accountStatus: user.accountStatus,
      emailVerified: user.emailVerifiedAt !== null,
      ageEligibilityStatus: user.ageEligibilityStatus,
      identityVerificationStatus: user.identityVerificationStatus,
      adminReviewStatus: user.adminReviewStatus,
      verificationSession: session
        ? {
            sessionId: session.id,
            status: session.status,
            provider: session.provider,
            completedAt: session.completedAt?.toISOString() ?? null,
            expiresAt: session.sessionExpiresAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
          }
        : null,
      providerIdentityApprovedAt: user.identityVerificationApprovedAt?.toISOString() ?? null,
      identityValidUntil: user.identityVerificationValidUntil?.toISOString() ?? null,
      identityRevokedAt: user.identityVerificationRevokedAt?.toISOString() ?? null,
      adminReviewDecidedAt: user.adminReviewDecidedAt?.toISOString() ?? null,
      recentDecisions: recentDecisions.map((d) => ({
        decisionId: d.id,
        status: d.status,
        reasonCode: d.reasonCode,
        verificationSessionId: d.verificationSessionId,
        reviewerUserId: d.reviewerUserId,
        createdAt: d.createdAt.toISOString(),
      })),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * Staff-scoped profile avatar for an identity review subject (general media, not KYC evidence).
   */
  async getApplicantAvatar(reviewId: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!this.avatarStorage) {
      throw new AppError("SERVICE_UNAVAILABLE", "Avatar storage is not configured", 503);
    }

    const user = await this.db.user.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        deletedAt: true,
        profile: {
          select: { avatarStorageKey: true, avatarContentType: true },
        },
      },
    });
    if (!user || user.deletedAt) {
      throw new AppError("NOT_FOUND", "Identity review not found", 404);
    }

    const storageKey = user.profile?.avatarStorageKey;
    const contentType = user.profile?.avatarContentType;
    if (!storageKey || !contentType) {
      throw new AppError("NOT_FOUND", "Avatar not found", 404);
    }

    this.avatarStorage.assertStorageKeyOwnedByUser(storageKey, user.id);
    const buffer = await this.avatarStorage.readBytes(storageKey, user.id);
    return { buffer, contentType };
  }

  async approveReview(input: { reviewer: User; reviewId: string; idempotencyKey?: string }) {
    if (input.reviewer.id === input.reviewId) {
      throw new AppError("AUTH_FORBIDDEN", "Administrators cannot review their own identity", 403);
    }

    const kycCtx = buildKycCtx(this.env);
    const verificationConfig = resolveVerificationRuntimeConfig(this.env);
    if (this.env.isProduction && verificationConfig.provider === "MOCK") {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Identity approval is not available with mock provider in production",
        403,
      );
    }

    const idempotency = await this.beginIdempotentAdminReviewMutation({
      headerKey: input.idempotencyKey,
      reviewerUserId: input.reviewer.id,
      reviewId: input.reviewId,
      action: "approve",
    });
    if (idempotency.earlyReplay) {
      return idempotency.earlyReplay;
    }

    return this.db.$transaction(async (tx) => {
      const reservationClaim = idempotency.prepared
        ? await this.claimIdempotencyReservationInTransaction(tx, idempotency.prepared, {
            reviewerUserId: input.reviewer.id,
            reviewId: input.reviewId,
            action: "approve",
          })
        : null;
      if (reservationClaim?.kind === "replay") {
        return reservationClaim.result;
      }
      const reservationId =
        reservationClaim?.kind === "claimed" ? reservationClaim.reservationId : undefined;

      const user = await tx.user.findUnique({ where: { id: input.reviewId } });
      if (!user) {
        throw new AppError("NOT_FOUND", "Identity review not found", 404);
      }

      const eligibility = await this.evaluateApprovalEligibility(user, kycCtx, tx);
      if (!eligibility.ok) {
        throw new AppError(eligibility.code, eligibility.message, eligibility.status);
      }

      const sessionId = user.identityVerificationSessionId!;
      const session = await tx.verificationSession.findFirst({
        where: { id: sessionId, userId: user.id },
      });
      if (!session || session.status !== "APPROVED") {
        throw new AppError(
          "CONFLICT",
          "Provider verification session is not in an approvable state",
          409,
        );
      }

      if (
        user.adminReviewStatus === "APPROVED" &&
        user.adminReviewVerificationSessionId === sessionId
      ) {
        return await this.completeIdempotentReservationReplay(tx, reservationId, {
          reviewId: user.id,
          adminReviewStatus: user.adminReviewStatus,
        });
      }

      if (user.adminReviewStatus !== "PENDING") {
        throw new AppError("CONFLICT", "Identity review is not pending administrator action", 409);
      }

      const now = new Date();
      const applied = await tx.user.updateMany({
        where: { id: user.id, adminReviewStatus: "PENDING" },
        data: {
          adminReviewStatus: "APPROVED",
          adminReviewVerificationSessionId: sessionId,
          adminReviewDecidedAt: now,
        },
      });
      if (applied.count !== 1) {
        throw new AppError("CONFLICT", "Identity review was updated by another administrator", 409);
      }

      const decisionId = randomUUID();
      await tx.identityAdminReviewDecision.create({
        data: {
          id: decisionId,
          userId: user.id,
          verificationSessionId: sessionId,
          status: "APPROVED",
          reviewerUserId: input.reviewer.id,
          idempotencyKey: idempotency.prepared?.scopedDecisionKey ?? null,
        },
      });

      await this.finalizeIdempotencyReservation(tx, reservationId, {
        decisionId,
        responseReviewId: user.id,
        responseAdminReviewStatus: "APPROVED",
      });

      return {
        reviewId: user.id,
        adminReviewStatus: "APPROVED" as const,
        idempotentReplay: false as const,
      };
    });
  }

  async rejectReview(input: {
    reviewer: User;
    reviewId: string;
    reasonCode: string;
    idempotencyKey?: string;
  }) {
    if (!isAdminIdentityReviewRejectReasonCode(input.reasonCode)) {
      throw new AppError("VALIDATION_ERROR", "Invalid rejection reason code", 400);
    }
    if (input.reviewer.id === input.reviewId) {
      throw new AppError("AUTH_FORBIDDEN", "Administrators cannot review their own identity", 403);
    }

    const idempotency = await this.beginIdempotentAdminReviewMutation({
      headerKey: input.idempotencyKey,
      reviewerUserId: input.reviewer.id,
      reviewId: input.reviewId,
      action: "reject",
      reasonCode: input.reasonCode,
    });
    if (idempotency.earlyReplay) {
      return idempotency.earlyReplay;
    }

    return this.db.$transaction(async (tx) => {
      const reservationClaim = idempotency.prepared
        ? await this.claimIdempotencyReservationInTransaction(tx, idempotency.prepared, {
            reviewerUserId: input.reviewer.id,
            reviewId: input.reviewId,
            action: "reject",
          })
        : null;
      if (reservationClaim?.kind === "replay") {
        return reservationClaim.result;
      }
      const reservationId =
        reservationClaim?.kind === "claimed" ? reservationClaim.reservationId : undefined;

      const user = await tx.user.findUnique({ where: { id: input.reviewId } });
      if (!user) {
        throw new AppError("NOT_FOUND", "Identity review not found", 404);
      }

      if (user.adminReviewStatus === "REJECTED") {
        return await this.completeIdempotentReservationReplay(tx, reservationId, {
          reviewId: user.id,
          adminReviewStatus: user.adminReviewStatus,
        });
      }

      if (user.adminReviewStatus !== "PENDING") {
        throw new AppError("CONFLICT", "Identity review is not pending administrator action", 409);
      }

      const sessionId = user.adminReviewVerificationSessionId ?? user.identityVerificationSessionId;
      if (!sessionId) {
        throw new AppError("CONFLICT", "No verification session bound to this review", 409);
      }

      const now = new Date();
      const applied = await tx.user.updateMany({
        where: { id: user.id, adminReviewStatus: "PENDING" },
        data: {
          adminReviewStatus: "REJECTED",
          adminReviewVerificationSessionId: sessionId,
          adminReviewDecidedAt: now,
        },
      });
      if (applied.count !== 1) {
        throw new AppError("CONFLICT", "Identity review was updated by another administrator", 409);
      }

      const decisionId = randomUUID();
      await tx.identityAdminReviewDecision.create({
        data: {
          id: decisionId,
          userId: user.id,
          verificationSessionId: sessionId,
          status: "REJECTED",
          reasonCode: input.reasonCode,
          reviewerUserId: input.reviewer.id,
          idempotencyKey: idempotency.prepared?.scopedDecisionKey ?? null,
        },
      });

      await this.finalizeIdempotencyReservation(tx, reservationId, {
        decisionId,
        responseReviewId: user.id,
        responseAdminReviewStatus: "REJECTED",
      });

      return {
        reviewId: user.id,
        adminReviewStatus: "REJECTED" as const,
        idempotentReplay: false as const,
      };
    });
  }

  async needsFurtherReview(input: {
    reviewer: User;
    reviewId: string;
    optionalNote?: string;
    idempotencyKey?: string;
  }) {
    assertNotSelfReview(input.reviewer.id, input.reviewId);

    const idempotency = await this.beginIdempotentAdminReviewMutation({
      headerKey: input.idempotencyKey,
      reviewerUserId: input.reviewer.id,
      reviewId: input.reviewId,
      action: "needs_further_review",
      optionalNote: input.optionalNote,
    });
    if (idempotency.earlyReplay) {
      return idempotency.earlyReplay;
    }

    const kycCtx = buildKycCtx(this.env);

    return this.db.$transaction(async (tx) => {
      const reservationClaim = idempotency.prepared
        ? await this.claimIdempotencyReservationInTransaction(tx, idempotency.prepared, {
            reviewerUserId: input.reviewer.id,
            reviewId: input.reviewId,
            action: "needs_further_review",
          })
        : null;
      if (reservationClaim?.kind === "replay") {
        return reservationClaim.result;
      }
      const reservationId =
        reservationClaim?.kind === "claimed" ? reservationClaim.reservationId : undefined;

      const user = await tx.user.findUnique({ where: { id: input.reviewId } });
      if (!user || user.deletedAt) {
        throw new AppError("NOT_FOUND", "Identity review not found", 404);
      }

      const eligibility = await this.evaluateApprovalEligibility(user, kycCtx, tx);
      if (!eligibility.ok) {
        throw new AppError(eligibility.code, eligibility.message, eligibility.status);
      }

      if (user.adminReviewStatus === "NEEDS_FURTHER_REVIEW") {
        return await this.completeIdempotentReservationReplay(tx, reservationId, {
          reviewId: user.id,
          adminReviewStatus: user.adminReviewStatus,
        });
      }

      if (user.adminReviewStatus !== "PENDING") {
        throw new AppError("CONFLICT", "Identity review is not pending administrator action", 409);
      }

      assertQueueSessionBinding(user);

      const sessionId = user.adminReviewVerificationSessionId!;
      const applied = await tx.user.updateMany({
        where: { id: user.id, adminReviewStatus: "PENDING" },
        data: { adminReviewStatus: "NEEDS_FURTHER_REVIEW" },
      });
      if (applied.count !== 1) {
        throw new AppError("CONFLICT", "Identity review was updated by another administrator", 409);
      }

      const decisionId = randomUUID();
      await tx.identityAdminReviewDecision.create({
        data: {
          id: decisionId,
          userId: user.id,
          verificationSessionId: sessionId,
          status: "NEEDS_FURTHER_REVIEW",
          reviewerUserId: input.reviewer.id,
          idempotencyKey: idempotency.prepared?.scopedDecisionKey ?? null,
        },
      });

      if (input.optionalNote?.trim()) {
        await tx.identityAdminReviewInternalNote.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            authorUserId: input.reviewer.id,
            body: input.optionalNote.trim(),
          },
        });
      }

      await this.finalizeIdempotencyReservation(tx, reservationId, {
        decisionId,
        responseReviewId: user.id,
        responseAdminReviewStatus: "NEEDS_FURTHER_REVIEW",
      });

      return {
        reviewId: user.id,
        adminReviewStatus: "NEEDS_FURTHER_REVIEW" as const,
        idempotentReplay: false as const,
      };
    });
  }

  async returnToPending(input: {
    reviewer: User;
    reviewId: string;
    optionalNote?: string;
    idempotencyKey?: string;
  }) {
    assertNotSelfReview(input.reviewer.id, input.reviewId);

    const idempotency = await this.beginIdempotentAdminReviewMutation({
      headerKey: input.idempotencyKey,
      reviewerUserId: input.reviewer.id,
      reviewId: input.reviewId,
      action: "return_to_pending",
      optionalNote: input.optionalNote,
    });
    if (idempotency.earlyReplay) {
      return idempotency.earlyReplay;
    }

    const kycCtx = buildKycCtx(this.env);

    return this.db.$transaction(async (tx) => {
      const reservationClaim = idempotency.prepared
        ? await this.claimIdempotencyReservationInTransaction(tx, idempotency.prepared, {
            reviewerUserId: input.reviewer.id,
            reviewId: input.reviewId,
            action: "return_to_pending",
          })
        : null;
      if (reservationClaim?.kind === "replay") {
        return reservationClaim.result;
      }
      const reservationId =
        reservationClaim?.kind === "claimed" ? reservationClaim.reservationId : undefined;

      const user = await tx.user.findUnique({ where: { id: input.reviewId } });
      if (!user || user.deletedAt) {
        throw new AppError("NOT_FOUND", "Identity review not found", 404);
      }

      const eligibility = await this.evaluateApprovalEligibility(user, kycCtx, tx);
      if (!eligibility.ok) {
        throw new AppError(eligibility.code, eligibility.message, eligibility.status);
      }

      if (user.adminReviewStatus === "PENDING") {
        return await this.completeIdempotentReservationReplay(tx, reservationId, {
          reviewId: user.id,
          adminReviewStatus: user.adminReviewStatus,
        });
      }

      if (user.adminReviewStatus !== "NEEDS_FURTHER_REVIEW") {
        throw new AppError("CONFLICT", "Identity review is not on internal hold", 409);
      }

      assertQueueSessionBinding(user);

      const sessionId = user.adminReviewVerificationSessionId!;
      const applied = await tx.user.updateMany({
        where: { id: user.id, adminReviewStatus: "NEEDS_FURTHER_REVIEW" },
        data: { adminReviewStatus: "PENDING" },
      });
      if (applied.count !== 1) {
        throw new AppError("CONFLICT", "Identity review was updated by another administrator", 409);
      }

      const decisionId = randomUUID();
      await tx.identityAdminReviewDecision.create({
        data: {
          id: decisionId,
          userId: user.id,
          verificationSessionId: sessionId,
          status: "PENDING",
          reasonCode: "RETURNED_TO_PENDING",
          reviewerUserId: input.reviewer.id,
          idempotencyKey: idempotency.prepared?.scopedDecisionKey ?? null,
        },
      });

      if (input.optionalNote?.trim()) {
        await tx.identityAdminReviewInternalNote.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            authorUserId: input.reviewer.id,
            body: input.optionalNote.trim(),
          },
        });
      }

      await this.finalizeIdempotencyReservation(tx, reservationId, {
        decisionId,
        responseReviewId: user.id,
        responseAdminReviewStatus: "PENDING",
      });

      return {
        reviewId: user.id,
        adminReviewStatus: "PENDING" as const,
        idempotentReplay: false as const,
      };
    });
  }

  async listReviewDecisions(input: { reviewId: string; limit: number; cursor?: string }) {
    const subject = await this.db.user.findUnique({
      where: { id: input.reviewId },
      select: { id: true, deletedAt: true },
    });
    if (!subject || subject.deletedAt) {
      throw new AppError("NOT_FOUND", "Identity review not found", 404);
    }

    const decoded = decodeDecisionsCursor(input.cursor);
    const take = input.limit + 1;
    const rows = await this.db.identityAdminReviewDecision.findMany({
      where: {
        userId: input.reviewId,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                {
                  AND: [{ createdAt: decoded.createdAt }, { id: { lt: decoded.decisionId } }],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      select: {
        id: true,
        status: true,
        reasonCode: true,
        verificationSessionId: true,
        reviewerUserId: true,
        createdAt: true,
      },
    });

    const page = rows.slice(0, input.limit);
    const reviewerIds = [
      ...new Set(page.map((row) => row.reviewerUserId).filter((id): id is string => id !== null)),
    ];
    const reviewers =
      reviewerIds.length > 0
        ? await this.db.user.findMany({
            where: { id: { in: reviewerIds } },
            select: {
              id: true,
              profile: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  avatarStorageKey: true,
                },
              },
            },
          })
        : [];
    const reviewerLabels = new Map(
      reviewers.map((r) => [r.id, resolveStaffAuthorDisplayLabel(r.profile, r.id)]),
    );

    const nextCursor =
      rows.length > input.limit && page.length > 0
        ? encodeDecisionsCursor({
            createdAt: page[page.length - 1].createdAt,
            decisionId: page[page.length - 1].id,
          })
        : null;

    return {
      decisions: page.map((row) => ({
        decisionId: row.id,
        status: row.status,
        reasonCode: row.reasonCode,
        verificationSessionId: row.verificationSessionId,
        reviewerUserId: row.reviewerUserId,
        reviewerDisplayLabel: row.reviewerUserId
          ? (reviewerLabels.get(row.reviewerUserId) ??
            resolveStaffAuthorDisplayLabel(null, row.reviewerUserId))
          : null,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async listInternalNotes(input: { reviewId: string; limit: number; cursor?: string }) {
    const subject = await this.db.user.findUnique({
      where: { id: input.reviewId },
      select: { id: true, deletedAt: true },
    });
    if (!subject || subject.deletedAt) {
      throw new AppError("NOT_FOUND", "Identity review not found", 404);
    }

    const decoded = decodeNotesCursor(input.cursor);
    const take = input.limit + 1;
    const rows = await this.db.identityAdminReviewInternalNote.findMany({
      where: {
        userId: input.reviewId,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                {
                  AND: [{ createdAt: decoded.createdAt }, { id: { lt: decoded.noteId } }],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      select: {
        id: true,
        authorUserId: true,
        body: true,
        createdAt: true,
        redactedAt: true,
        author: {
          select: {
            profile: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true,
                avatarStorageKey: true,
              },
            },
          },
        },
      },
    });

    const page = rows.slice(0, input.limit);
    const nextCursor =
      rows.length > input.limit && page.length > 0
        ? encodeNotesCursor({
            createdAt: page[page.length - 1].createdAt,
            noteId: page[page.length - 1].id,
          })
        : null;

    return {
      notes: page.map((row) => ({
        noteId: row.id,
        authorUserId: row.authorUserId,
        authorDisplayLabel: resolveStaffAuthorDisplayLabel(row.author.profile, row.authorUserId),
        createdAt: row.createdAt.toISOString(),
        body: row.redactedAt ? null : row.body,
        redacted: row.redactedAt !== null,
      })),
      nextCursor,
    };
  }

  async createInternalNote(input: { reviewer: User; reviewId: string; body: string }) {
    assertNotSelfReview(input.reviewer.id, input.reviewId);

    const user = await this.db.user.findUnique({
      where: { id: input.reviewId },
      select: { id: true, deletedAt: true, adminReviewStatus: true },
    });
    if (!user || user.deletedAt) {
      throw new AppError("NOT_FOUND", "Identity review not found", 404);
    }

    assertNotesAllowedForStatus(user.adminReviewStatus);

    const note = await this.db.identityAdminReviewInternalNote.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        authorUserId: input.reviewer.id,
        body: input.body.trim(),
      },
      select: {
        id: true,
        authorUserId: true,
        body: true,
        createdAt: true,
        author: {
          select: {
            profile: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true,
                avatarStorageKey: true,
              },
            },
          },
        },
      },
    });

    return {
      noteId: note.id,
      authorUserId: note.authorUserId,
      authorDisplayLabel: resolveStaffAuthorDisplayLabel(note.author.profile, note.authorUserId),
      createdAt: note.createdAt.toISOString(),
      body: note.body,
      redacted: false,
    };
  }

  private async beginIdempotentAdminReviewMutation(input: {
    headerKey?: string;
    reviewerUserId: string;
    reviewId: string;
    action: IdentityAdminReviewIdempotencyAction;
    reasonCode?: string;
    optionalNote?: string;
  }): Promise<{
    prepared?: IdentityAdminReviewPreparedIdempotency;
    earlyReplay?: IdentityReviewMutationReplay;
  }> {
    const clientKey = parseIdentityAdminReviewClientKeyHeader(input.headerKey);
    if (!clientKey) {
      return {};
    }

    const prepared = prepareIdentityAdminReviewIdempotency({
      reviewerUserId: input.reviewerUserId,
      reviewId: input.reviewId,
      action: input.action,
      clientKey,
      reasonCode: input.reasonCode,
      optionalNote: input.optionalNote,
    });

    const reservationReplay = await this.tryReplayFromIdempotencyReservation(
      prepared,
      input.reviewerUserId,
      input.reviewId,
      input.action,
    );
    if (reservationReplay) {
      return { earlyReplay: reservationReplay };
    }

    const decisionReplay = await this.tryReplayAdminReviewDecision({
      headerKey: clientKey,
      reviewerUserId: input.reviewerUserId,
      reviewId: input.reviewId,
      action: input.action,
      reasonCode: input.reasonCode,
      optionalNote: input.optionalNote,
    });
    if (decisionReplay) {
      return { earlyReplay: decisionReplay };
    }

    await this.assertNoCrossContextIdempotencyReuse({
      scopedKey: prepared.scopedDecisionKey,
      reviewId: input.reviewId,
      reviewerUserId: input.reviewerUserId,
      action: input.action,
      reasonCode: input.reasonCode,
      optionalNote: input.optionalNote,
      headerKey: clientKey,
    });

    return { prepared };
  }

  private async tryReplayFromIdempotencyReservation(
    prepared: IdentityAdminReviewPreparedIdempotency,
    reviewerUserId: string,
    reviewId: string,
    action: IdentityAdminReviewIdempotencyAction,
  ): Promise<IdentityReviewMutationReplay | null> {
    const existing = await this.db.identityAdminReviewIdempotencyReservation.findUnique({
      where: {
        reviewerUserId_clientKeyDigest: {
          reviewerUserId,
          clientKeyDigest: prepared.clientKeyDigest,
        },
      },
      select: {
        reviewId: true,
        action: true,
        payloadFingerprint: true,
        responseReviewId: true,
        responseAdminReviewStatus: true,
        decisionId: true,
      },
    });
    if (!existing) {
      return null;
    }

    const resolution = resolveIdentityAdminReviewIdempotencyReservation(existing, {
      reviewId,
      action,
      payloadFingerprint: prepared.payloadFingerprint,
    });
    if (resolution.kind === "replay") {
      return toIdempotentReplayResponse(resolution);
    }
    if (resolution.kind === "conflict") {
      throwIdempotencyReservationConflict();
    }
    throwIdempotencyReservationInProgress();
  }

  private async claimIdempotencyReservationInTransaction(
    tx: IdentityReviewMutationTx,
    prepared: IdentityAdminReviewPreparedIdempotency,
    input: {
      reviewerUserId: string;
      reviewId: string;
      action: IdentityAdminReviewIdempotencyAction;
    },
  ): Promise<
    | { kind: "claimed"; reservationId: string }
    | { kind: "replay"; result: IdentityReviewMutationReplay }
  > {
    const reservationId = randomUUID();
    try {
      await tx.identityAdminReviewIdempotencyReservation.create({
        data: {
          id: reservationId,
          reviewerUserId: input.reviewerUserId,
          clientKeyDigest: prepared.clientKeyDigest,
          reviewId: input.reviewId,
          action: input.action,
          payloadFingerprint: prepared.payloadFingerprint,
          scopedDecisionKey: prepared.scopedDecisionKey,
          responseReviewId: input.reviewId,
          responseAdminReviewStatus: null,
          decisionId: null,
        },
      });
      return { kind: "claimed", reservationId };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      const existing = await tx.identityAdminReviewIdempotencyReservation.findUnique({
        where: {
          reviewerUserId_clientKeyDigest: {
            reviewerUserId: input.reviewerUserId,
            clientKeyDigest: prepared.clientKeyDigest,
          },
        },
        select: {
          reviewId: true,
          action: true,
          payloadFingerprint: true,
          responseReviewId: true,
          responseAdminReviewStatus: true,
          decisionId: true,
        },
      });
      if (!existing) {
        throwIdempotencyReservationInProgress();
      }

      const resolution = resolveIdentityAdminReviewIdempotencyReservation(existing, {
        reviewId: input.reviewId,
        action: input.action,
        payloadFingerprint: prepared.payloadFingerprint,
      });
      if (resolution.kind === "replay") {
        return { kind: "replay", result: toIdempotentReplayResponse(resolution) };
      }
      if (resolution.kind === "conflict") {
        throwIdempotencyReservationConflict();
      }
      throwIdempotencyReservationInProgress();
    }
  }

  private async finalizeIdempotencyReservation(
    tx: IdentityReviewMutationTx,
    reservationId: string | undefined,
    input: {
      decisionId: string;
      responseReviewId: string;
      responseAdminReviewStatus: User["adminReviewStatus"];
    },
  ): Promise<void> {
    if (!reservationId) {
      return;
    }
    await tx.identityAdminReviewIdempotencyReservation.update({
      where: { id: reservationId },
      data: {
        decisionId: input.decisionId,
        responseReviewId: input.responseReviewId,
        responseAdminReviewStatus: input.responseAdminReviewStatus,
      },
    });
  }

  private async completeIdempotentReservationReplay(
    tx: IdentityReviewMutationTx,
    reservationId: string | undefined,
    input: {
      reviewId: string;
      adminReviewStatus: User["adminReviewStatus"];
    },
  ): Promise<IdentityReviewMutationReplay> {
    if (reservationId) {
      await tx.identityAdminReviewIdempotencyReservation.update({
        where: { id: reservationId },
        data: {
          responseReviewId: input.reviewId,
          responseAdminReviewStatus: input.adminReviewStatus,
        },
      });
    }
    return {
      reviewId: input.reviewId,
      adminReviewStatus: input.adminReviewStatus,
      idempotentReplay: true as const,
    };
  }

  private async assertNoCrossContextIdempotencyReuse(input: {
    scopedKey: string;
    reviewId: string;
    reviewerUserId: string;
    action: IdentityAdminReviewIdempotencyAction;
    reasonCode?: string;
    optionalNote?: string;
    headerKey: string;
  }): Promise<void> {
    const trimmedHeader = input.headerKey.trim();
    const existing = await this.db.identityAdminReviewDecision.findMany({
      where: {
        reviewerUserId: input.reviewerUserId,
        idempotencyKey: { not: null },
        OR: [
          { idempotencyKey: trimmedHeader },
          { idempotencyKey: { startsWith: "identity-admin-review:" } },
        ],
      },
      select: {
        userId: true,
        status: true,
        reasonCode: true,
        reviewerUserId: true,
        idempotencyKey: true,
      },
    });

    assertNoCrossContextClientHeaderReuse(existing, {
      scopedKey: input.scopedKey,
      reviewId: input.reviewId,
      reviewerUserId: input.reviewerUserId,
      action: input.action,
      reasonCode: input.reasonCode,
      optionalNote: input.optionalNote,
      headerKey: trimmedHeader,
    });
  }

  private async tryReplayAdminReviewDecision(input: {
    headerKey?: string;
    reviewerUserId: string;
    reviewId: string;
    action: IdentityAdminReviewIdempotencyAction;
    reasonCode?: string;
    optionalNote?: string;
  }): Promise<{
    reviewId: string;
    adminReviewStatus: User["adminReviewStatus"];
    idempotentReplay: true;
  } | null> {
    const trimmedHeader = input.headerKey?.trim();
    if (!trimmedHeader) {
      return null;
    }

    const scopedKey = resolveStoredIdentityAdminReviewIdempotencyKey({
      reviewerUserId: input.reviewerUserId,
      reviewId: input.reviewId,
      action: input.action,
      headerKey: trimmedHeader,
      reasonCode: input.reasonCode,
      optionalNote: input.optionalNote,
    });

    const priorScoped = await this.db.identityAdminReviewDecision.findUnique({
      where: { idempotencyKey: scopedKey },
    });
    const priorLegacy =
      trimmedHeader !== scopedKey
        ? await this.db.identityAdminReviewDecision.findUnique({
            where: { idempotencyKey: trimmedHeader },
          })
        : null;
    const prior = priorScoped ?? priorLegacy;

    if (!prior) {
      return null;
    }

    assertIdempotencyDecisionMatchesRequest(prior, {
      reviewId: input.reviewId,
      reviewerUserId: input.reviewerUserId,
      action: input.action,
      reasonCode: input.reasonCode,
      headerKey: trimmedHeader,
      optionalNote: input.optionalNote,
    });

    const user = await this.db.user.findUnique({ where: { id: input.reviewId } });
    if (!user) {
      throw new AppError("NOT_FOUND", "Identity review not found", 404);
    }

    return {
      reviewId: user.id,
      adminReviewStatus: user.adminReviewStatus,
      idempotentReplay: true as const,
    };
  }

  private async evaluateApprovalEligibility(
    user: User,
    kycCtx: KycEnforcementContext,
    db: Pick<DatabaseClient, "consentRecord"> = this.db,
  ): Promise<{ ok: true } | { ok: false; code: AppErrorCode; message: string; status: number }> {
    if (
      user.deletedAt ||
      user.suspendedAt ||
      user.accountStatus === "DELETED" ||
      user.accountStatus === "SUSPENDED"
    ) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Account is not eligible for activation",
        status: 403,
      };
    }
    if (user.accountStatus !== "ACTIVE") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Active account is required for activation",
        status: 403,
      };
    }
    if (user.ageEligibilityStatus !== "ELIGIBLE") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Age eligibility requirements are not satisfied",
        status: 403,
      };
    }

    const consentCtx = buildConsentRegistryContext(this.env);
    const consents = await db.consentRecord.findMany({
      where: { userId: user.id },
      select: { consentType: true, documentId: true, documentVersion: true },
    });
    const consentCheck = userRegistrationConsentsSatisfyRegistry(consents, consentCtx);
    if (!consentCheck.ok) {
      return {
        ok: false,
        code:
          consentCheck.code === "CONSENT_VERSION_UNAVAILABLE"
            ? "SERVICE_UNAVAILABLE"
            : "AUTH_FORBIDDEN",
        message: consentCheck.message,
        status: consentCheck.code === "CONSENT_VERSION_UNAVAILABLE" ? 503 : 403,
      };
    }

    if (
      !hasTrustedKycForEnforcement(
        {
          identityVerificationStatus: user.identityVerificationStatus,
          identityVerificationApprovedAt: user.identityVerificationApprovedAt,
          identityVerificationValidUntil: user.identityVerificationValidUntil,
          identityVerificationRevokedAt: user.identityVerificationRevokedAt,
        },
        kycCtx,
      )
    ) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Trusted provider identity approval is required",
        status: 403,
      };
    }

    if (
      !user.identityVerificationSessionId ||
      !user.adminReviewVerificationSessionId ||
      user.identityVerificationSessionId !== user.adminReviewVerificationSessionId
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Admin review session does not match current provider verification session",
        status: 409,
      };
    }

    return { ok: true };
  }
}
