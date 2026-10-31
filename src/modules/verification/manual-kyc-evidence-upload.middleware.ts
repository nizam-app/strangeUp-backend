import multer from "multer";
import type { RequestHandler } from "express";
import { MANUAL_KYC_EVIDENCE_MAX_BYTES } from "./manual-kyc.constants.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MANUAL_KYC_EVIDENCE_MAX_BYTES, files: 1 },
});

export const manualKycEvidenceUploadMiddleware: RequestHandler = upload.single("evidence");
