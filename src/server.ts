import "dotenv/config";
import pino from "pino";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { disconnectPrisma, getPrismaClient } from "./infrastructure/database/prisma.js";
import {
  configureRateLimitStore,
  disconnectRateLimitStore,
  resolveRateLimitStore,
} from "./modules/auth/rate-limit.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "DATABASE_URL",
        "RATE_LIMIT_REDIS_URL",
        "RESEND_API_KEY",
        "req.headers.authorization",
        "password",
        "secret",
      ],
      censor: "[REDACTED]",
    },
  });

  configureRateLimitStore(await resolveRateLimitStore(env, logger));

  const db = env.DATABASE_URL ? getPrismaClient(env.DATABASE_URL) : null;
  const app = createApp({ env, logger, db });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "server listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutdown requested");
    server.close(() => {
      void disconnectRateLimitStore()
        .then(() => disconnectPrisma())
        .then(() => {
          logger.info("server stopped");
          process.exit(0);
        });
    });

    setTimeout(() => {
      logger.error("forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

try {
  await main();
} catch (err: unknown) {
  console.error(err);
  process.exit(1);
}
