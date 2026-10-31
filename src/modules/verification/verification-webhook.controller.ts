import type { Request, Response } from "express";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { VerificationService } from "./verification.service.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  extractVeriffAuthClientHeader,
  extractWebhookHmacSignature,
} from "./veriff-webhook-headers.js";

export function createVerificationWebhookController(deps: { db: DatabaseClient; env: AppEnv }) {
  const service = new VerificationService(deps.db, deps.env);

  return {
    async handleVerificationWebhook(req: Request, res: Response): Promise<void> {
      const provider = req.params.provider;
      const rawBody: unknown = req.body;
      if (!Buffer.isBuffer(rawBody)) {
        throw new AppError("VALIDATION_ERROR", "Expected raw webhook body", 400);
      }

      const signature = extractWebhookHmacSignature(req.headers);

      if (provider === "mock") {
        const result = await service.processMockWebhook(rawBody, signature);
        res.status(200).json({
          data: { accepted: true, duplicate: result.duplicate ?? false },
          meta: { requestId: req.requestId },
        });
        return;
      }

      if (provider === "veriff") {
        const clientHeader = extractVeriffAuthClientHeader(req.headers);
        const result = await service.processVeriffWebhook(rawBody, signature, clientHeader);
        res.status(200).json({
          data: {
            accepted: true,
            duplicate: result.duplicate ?? false,
            ignored: result.ignored ?? false,
          },
          meta: { requestId: req.requestId },
        });
        return;
      }

      throw new AppError("NOT_FOUND", "Unknown verification provider", 404);
    },
  };
}
