import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { IdentityAdminReviewService } from "./identity-admin-review.service.js";
import {
  identityReviewListQuerySchema,
  identityReviewRejectBodySchema,
} from "./identity-admin-review.validation.js";

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
}) {
  const service = new IdentityAdminReviewService(deps.db, deps.env);

  return {
    list: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = identityReviewListQuerySchema.parse(req.query);
      const data = await service.listReviews(query);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    detail: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewId = String(req.params.reviewId);
      const data = await service.getReviewDetail(reviewId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
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
  };
}
