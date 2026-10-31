import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { createKycEvidenceStore } from "../../infrastructure/kyc-evidence-storage/create-kyc-evidence-store.js";
import { ManualKycEvidenceService } from "./manual-kyc-evidence.service.js";
import { ManualKycService } from "./manual-kyc.service.js";
import {
  manualKycEvidenceKindSchema,
  startManualVerificationSessionBodySchema,
} from "./manual-kyc.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createManualKycController(deps: { db: DatabaseClient; env: AppEnv }) {
  const evidenceStore = createKycEvidenceStore(deps.env);
  const manualKyc = new ManualKycService(deps.db, deps.env);
  const evidence = new ManualKycEvidenceService(deps.db, deps.env, evidenceStore);

  return {
    startSession: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const body = startManualVerificationSessionBodySchema.parse(req.body ?? {});
      const data = await manualKyc.startManualSession(requireUser(req), {
        idDocumentType: body.idDocumentType,
        documentHasRearSide: body.documentHasRearSide,
      });
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },
    getSession: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const sessionId = String(req.params.sessionId);
      const data = await manualKyc.getManualSession(requireUser(req), sessionId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    cancelSession: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const sessionId = String(req.params.sessionId);
      const data = await manualKyc.cancelManualSession(requireUser(req), sessionId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    uploadEvidence: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const sessionId = String(req.params.sessionId);
      const bodyKind =
        req.body !== null && typeof req.body === "object" && "kind" in req.body
          ? (req.body as Record<string, unknown>).kind
          : undefined;
      const queryKind = typeof req.query.kind === "string" ? req.query.kind : undefined;
      const kind = manualKycEvidenceKindSchema.parse(bodyKind ?? queryKind);
      const file = req.file;
      if (!file?.buffer) {
        throw new AppError("VALIDATION_ERROR", "Evidence file is required", 400);
      }
      const data = await evidence.uploadEvidence({
        user,
        sessionId,
        kind,
        fileBuffer: file.buffer,
        mimeType: file.mimetype,
      });
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
