import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import pino from "pino";
import { attachMessagingRealtime } from "../src/modules/messaging-realtime/messaging-realtime.server.js";
import { buildTestEnv } from "./helpers/test-app.js";

describe("messaging-realtime startup policy", () => {
  it("throws when Redis Socket.IO adapter flag is enabled without implementation", () => {
    const httpServer = createServer();
    const env = buildTestEnv({ SOCKET_IO_REDIS_ADAPTER_ENABLED: true });
    expect(() =>
      attachMessagingRealtime({
        httpServer,
        db: null as never,
        env,
        authService: null as never,
        logger: pino({ level: "silent" }),
      }),
    ).toThrow(/Redis Socket.IO adapter is not implemented/);
    httpServer.close();
  });
});
