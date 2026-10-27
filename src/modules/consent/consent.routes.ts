import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import { createConsentController } from "./consent.controller.js";

export function createConsentRouter(deps: { env: AppEnv }): Router {
  const router = Router();
  const controller = createConsentController(deps);

  router.get("/required", (req, res) => {
    controller.getRequiredConsents(req, res);
  });

  return router;
}
