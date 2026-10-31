import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import type { AvatarStorage } from "../profile-media/local-avatar-storage.js";
import { IdentityAdminReviewService } from "./identity-admin-review.service.js";
import {
  identityReviewExportQuerySchema,
  identityReviewListQuerySchema,
  identityReviewRejectBodySchema,
  identityReviewSummaryQuerySchema,
} from "./identity-admin-review.validation.js";
import {
  identityReviewInternalNoteBodySchema,
  identityReviewNeedsFurtherReviewBodySchema,
  identityReviewDecisionsListQuerySchema,
  identityReviewNotesListQuerySchema,
} from "./identity-admin-review-note.validation.js";
import { identityReviewBatchDecideBodySchema } from "./identity-admin-review-batch.js";

const IDEMPOTENCY_HEADER = "idempotency-key";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createIdentityAdminReviewController(deps: {
  db: DatabaseClient;
  env: AppEnv;
  avatarStorage: AvatarStorage;
}) {
  const service = new IdentityAdminReviewService(deps.db, deps.env, deps.avatarStorage);

  return {
    summary: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      identityReviewSummaryQuerySchema.parse(req.query);
      const data = await service.getReviewSummary();
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    list: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = identityReviewListQuerySchema.parse(req.query);
      const data = await service.listReviews(query);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    exportCsv: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const query = identityReviewExportQuerySchema.parse(req.query);
      const result = await service.exportReviewsCsv(query);

      req.log?.info(
        {
          event: "identity_review_queue_csv_export",
          reviewerUserId: reviewer.id,
          filterDigest: result.filterDigest,
          rowCount: result.rowCount,
          truncated: result.truncated,
          status: query.status,
          posture: query.status === "PENDING" ? (query.posture ?? "all") : undefined,
        },
        "Identity review queue CSV export",
      );

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename.replace(/"/g, "")}"`,
      );
      res.setHeader("X-Identity-Review-Export-Row-Count", String(result.rowCount));
      res.setHeader("X-Identity-Review-Export-Truncated", result.truncated ? "true" : "false");
      res.setHeader("X-Identity-Review-Export-Max-Rows", String(result.maxRows));
      res.status(200).send(result.csv);
    },
    batchDecide: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const body = identityReviewBatchDecideBodySchema.parse(req.body ?? {});
      const data = await service.batchDecideReviews({ reviewer, body });

      req.log?.info(
        {
          event: "identity_review_batch_decide",
          reviewerUserId: reviewer.id,
          batchRequestId: body.batchRequestId,
          action: body.action,
          bindingFingerprint: data.bindingFingerprint,
          totalSelected: data.totalSelected,
          succeeded: data.succeeded,
          failed: data.failed,
        },
        "Identity review batch decide",
      );

      const status = data.allFailed ? 422 : 200;
      res.status(status).json({ data, meta: { requestId: req.requestId } });
    },
    detail: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewId = String(req.params.reviewId);
      const data = await service.getReviewDetail(reviewId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    avatar: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewId = String(req.params.reviewId);
      const { buffer, contentType } = await service.getApplicantAvatar(reviewId);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).send(buffer);
    },
    approve: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const reviewId = String(req.params.reviewId);
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER)?.trim();
      const data = await service.approveReview({ reviewer, reviewId, idempotencyKey });
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    reject: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const reviewId = String(req.params.reviewId);
      const body = identityReviewRejectBodySchema.parse(req.body ?? {});
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER)?.trim();
      const data = await service.rejectReview({
        reviewer,
        reviewId,
        reasonCode: body.reasonCode,
        idempotencyKey,
      });
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    needsFurtherReview: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const reviewId = String(req.params.reviewId);
      const body = identityReviewNeedsFurtherReviewBodySchema.parse(req.body ?? {});
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER)?.trim();
      const data = await service.needsFurtherReview({
        reviewer,
        reviewId,
        optionalNote: body.optionalNote,
        idempotencyKey,
      });
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    returnToPending: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const reviewId = String(req.params.reviewId);
      const body = identityReviewNeedsFurtherReviewBodySchema.parse(req.body ?? {});
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER)?.trim();
      const data = await service.returnToPending({
        reviewer,
        reviewId,
        optionalNote: body.optionalNote,
        idempotencyKey,
      });
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    listNotes: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewId = String(req.params.reviewId);
      const query = identityReviewNotesListQuerySchema.parse(req.query);
      const data = await service.listInternalNotes({
        reviewId,
        limit: query.limit,
        cursor: query.cursor,
      });
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    listDecisions: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewId = String(req.params.reviewId);
      const query = identityReviewDecisionsListQuerySchema.parse(req.query);
      const data = await service.listReviewDecisions({
        reviewId,
        limit: query.limit,
        cursor: query.cursor,
      });
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    createNote: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const reviewId = String(req.params.reviewId);
      const body = identityReviewInternalNoteBodySchema.parse(req.body ?? {});
      const data = await service.createInternalNote({
        reviewer,
        reviewId,
        body: body.body,
      });
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
