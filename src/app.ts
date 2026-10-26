import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import type { AppEnv } from "./config/env.js";
import { createErrorHandler, notFoundHandler } from "./common/middleware/error-handler.js";
import { requestIdMiddleware } from "./common/middleware/request-id.js";
import { redactSensitive } from "./common/utils/redact.js";
import type { DatabaseClient } from "./infrastructure/database/prisma.js";
import { createHealthRouter } from "./routes/health.js";

export type CreateAppDeps = {
  env: AppEnv;
  logger: Logger;
  db: DatabaseClient | null;
};

export function createApp(deps: CreateAppDeps): express.Application {
  const app = express();
  const { env, logger, db } = deps;

  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (req: express.Request) => ({ requestId: req.requestId }),
      serializers: {
        req: (req: express.Request) =>
          redactSensitive({
            method: req.method,
            url: req.url,
            headers: req.headers,
          }),
        res: (res: express.Response) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(
    cors({
      origin: env.corsOriginsList,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

  app.use("/health", createHealthRouter({ db }));

  app.use(notFoundHandler);
  app.use(createErrorHandler({ logger, isProduction: env.isProduction }));

  return app;
}
