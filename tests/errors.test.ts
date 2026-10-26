import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/test-app.js";

describe("error handling", () => {
  it("returns sanitized 404 for unknown routes", async () => {
    const app = createTestApp();
    const res = await request(app).get("/v1/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: expect.any(String),
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/stack/i);
  });

  it("returns 400 for invalid JSON payloads", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/health/live")
      .set("Content-Type", "application/json")
      .send("{ not-json");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.requestId).toEqual(expect.any(String));
  });

  it("does not expose stack traces in production mode", async () => {
    const app = createTestApp({ env: { isProduction: true, NODE_ENV: "production" } });
    const res = await request(app).get("/v1/trigger-internal");

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/stack/i);
  });
});
