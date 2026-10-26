import { Router } from "express";
import { AppError } from "../common/errors/app-error.js";
import type { ApiSuccessResponse } from "../common/types/api.js";
import type { DatabaseClient } from "../infrastructure/database/prisma.js";
import { checkDatabaseConnectivity } from "../infrastructure/database/prisma.js";

export type HealthLiveData = {
  status: "ok";
};

export type HealthReadyData = {
  status: "ok" | "degraded";
  checks: {
    database: "up" | "down";
  };
};

export function createHealthRouter(deps: { db: DatabaseClient | null }): Router {
  const router = Router();

  router.get("/live", (req, res) => {
    const body: ApiSuccessResponse<HealthLiveData> = {
      data: { status: "ok" },
      meta: { requestId: req.requestId },
    };
    res.status(200).json(body);
  });

  router.get("/ready", async (req, res, next) => {
    if (!deps.db) {
      const err = new AppError("SERVICE_UNAVAILABLE", "Database is not configured", 503, {
        exposeMessage: true,
      });
      next(err);
      return;
    }

    try {
      await checkDatabaseConnectivity(deps.db);
      const body: ApiSuccessResponse<HealthReadyData> = {
        data: {
          status: "ok",
          checks: { database: "up" },
        },
        meta: { requestId: req.requestId },
      };
      res.status(200).json(body);
    } catch {
      const err = new AppError("SERVICE_UNAVAILABLE", "Database is unavailable", 503, {
        exposeMessage: true,
      });
      next(err);
    }
  });

  return router;
}
