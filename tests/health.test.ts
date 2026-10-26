import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/test-app.js";
import { REQUEST_ID_HEADER } from "../src/common/middleware/request-id.js";
import type { DatabaseClient } from "../src/infrastructure/database/prisma.js";

describe("GET /health/live", () => {
  it("returns 200 with stable body and request ID", async () => {
    const app = createTestApp();
    const res = await request(app).get("/health/live");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { status: "ok" },
      meta: { requestId: expect.any(String) as string },
    });
    expect(res.headers[REQUEST_ID_HEADER.toLowerCase()]).toBe(res.body.meta.requestId);
  });

  it("propagates incoming x-request-id", async () => {
    const app = createTestApp();
    const res = await request(app)
      .get("/health/live")
      .set(REQUEST_ID_HEADER, "test-request-id-123");

    expect(res.status).toBe(200);
    expect(res.body.meta.requestId).toBe("test-request-id-123");
  });
});

describe("GET /health/ready", () => {
  it("returns 503 when database client is not configured", async () => {
    const app = createTestApp({ db: null });
    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.body.error.requestId).toEqual(expect.any(String));
  });

  it("returns 503 when database connectivity check fails", async () => {
    const failingDb = {
      $queryRaw: vi.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as DatabaseClient;

    const app = createTestApp({ db: failingDb });
    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("returns 200 when database is reachable", async () => {
    const okDb = {
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as DatabaseClient;

    const app = createTestApp({ db: okDb });
    const res = await request(app).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body.data.checks.database).toBe("up");
  });
});
