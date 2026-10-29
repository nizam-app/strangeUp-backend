import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
import { createApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import {
  createPrismaClient,
  disconnectPrisma,
  type DatabaseClient,
} from "../../src/infrastructure/database/prisma.js";
import { createCapturingEmailSender } from "../helpers/capturing-email-sender.js";
import { createIntegrationUser } from "../helpers/integration-user.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

const describe024c = runIntegration ? describe : describe.skip;

describe024c("integration: store pricing contract (Task 024C)", () => {
  let db: DatabaseClient;
  let app: ReturnType<typeof createApp>;
  const emailSender = createCapturingEmailSender();

  beforeAll(() => {
    const url = process.env.INTEGRATION_DATABASE_URL?.trim();
    if (!url) {
      throw new Error("INTEGRATION_DATABASE_URL required");
    }
    db = createPrismaClient(url);
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: url,
      CORS_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
      PROFILE_UPLOAD_DIR: ".data/test-avatars",
      ACTIVITY_UPLOAD_DIR: ".data/test-activity-media",
      GROUP_UPLOAD_DIR: ".data/test-group-media",
      STORE_UPLOAD_DIR: ".data/test-store-media",
    });
    app = createApp({ env, logger: pino({ level: "silent" }), db, emailSender });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(() => {
    clearRateLimits();
    emailSender.clear();
  });

  it("T024C-01 pricing-policy is NOT_CONFIGURED with canonical model", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "024c-policy");
    const res = await request(app)
      .get("/v1/store/pricing-policy")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.model).toBe("LIST_PRICE_PLUS_SINGLE_CART_DISCOUNT");
    expect(res.body.data.membershipDiscount.status).toBe("NOT_CONFIGURED");
    expect(res.body.data.checkout.status).toBe("UNAVAILABLE");
  });

  it("T024C-02 empty cart includes pricingQuote without discount amounts", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "024c-cart");
    const res = await request(app)
      .get("/v1/me/store/cart")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.pricingQuote.membershipDiscount.status).toBe("NOT_CONFIGURED");
    expect(res.body.data.pricingQuote.membershipDiscount.discountCents).toBeNull();
    expect(res.body.data.pricingQuote.totalDueCents).toBeNull();
    expect(res.body.data.checkout.status).toBe("UNAVAILABLE");
  });
});
