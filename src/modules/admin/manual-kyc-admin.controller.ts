import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { createKycEvidenceStore } from "../../infrastructure/kyc-evidence-storage/create-kyc-evidence-store.js";
import { ManualKycEvidenceService } from "../verification/manual-kyc-evidence.service.js";
import { ManualKycIdentityDecisionService } from "../verification/manual-kyc-identity-decision.service.js";
import { manualIdentityStaffDecisionSchema } from "../verification/manual-kyc.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createManualKycAdminController(deps: { db: DatabaseClient; env: AppEnv }) {
  const evidenceStore = createKycEvidenceStore(deps.env);
  const evidence = new ManualKycEvidenceService(deps.db, deps.env, evidenceStore);
  const identityDecision = new ManualKycIdentityDecisionService(deps.db, deps.env);

  return {
    listManualEvidence: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      requireUser(req);
      const reviewId = String(req.params.reviewId);
      const data = await evidence.listEvidenceForReview(reviewId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    getManualEvidenceBytes: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      requireUser(req);
      const reviewId = String(req.params.reviewId);
      const evidenceId = String(req.params.evidenceId);
      const { buffer, contentType } = await evidence.fetchEvidenceBytesForStaff({
        reviewUserId: reviewId,
        evidenceId,
      });
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).send(buffer);
    },
    deleteManualEvidence: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      requireUser(req);
      const reviewId = String(req.params.reviewId);
      const evidenceId = String(req.params.evidenceId);
      await evidence.deleteEvidenceForRetention({ reviewUserId: reviewId, evidenceId });
      res.status(204).end();
    },
    manualIdentityDecision: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const reviewId = String(req.params.reviewId);
      const body = manualIdentityStaffDecisionSchema.parse(req.body ?? {});
      const data = await identityDecision.applyStaffIdentityDecision({
        reviewer,
        reviewUserId: reviewId,
        decision: body.decision,
        reasonCode: body.reasonCode,
      });
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
