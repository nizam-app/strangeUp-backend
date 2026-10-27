import type { Request, Response } from "express";
import type { AppEnv } from "../../config/env.js";
import {
  listRegistrationRequirements,
  resolveJobApplicationRequirement,
} from "./canonical-consent-registry.js";
import { buildConsentRegistryContext } from "./consent-context.js";

export function createConsentController(deps: { env: AppEnv }) {
  return {
    getRequiredConsents(_req: Request, res: Response): void {
      const ctx = buildConsentRegistryContext(deps.env);
      const registration = listRegistrationRequirements(ctx);
      const jobApplication = resolveJobApplicationRequirement(ctx);
      res.status(200).json({
        data: {
          registration,
          jobApplication,
          enforcementMode: ctx.enforcementMode,
          counselNote:
            "Canonical legal document IDs and ACTIVE versions require owner/counsel approval before production registration.",
        },
        meta: { requestId: _req.requestId },
      });
    },
  };
}
