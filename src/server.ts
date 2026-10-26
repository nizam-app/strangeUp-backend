import "dotenv/config";
import pino from "pino";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { disconnectPrisma, getPrismaClient } from "./infrastructure/database/prisma.js";

function main(): void {
  const env = loadEnv();
  const logger = pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: ["DATABASE_URL", "req.headers.authorization", "password", "secret"],
      censor: "[REDACTED]",
    },
  });

  const db = env.DATABASE_URL ? getPrismaClient(env.DATABASE_URL) : null;
  const app = createApp({ env, logger, db });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "server listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutdown requested");
    server.close(() => {
      void disconnectPrisma().then(() => {
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
  main();
} catch (err: unknown) {
  console.error(err);
  process.exit(1);
}
