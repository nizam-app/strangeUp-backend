import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
import { randomUUID } from "node:crypto";
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

const describe024d = runIntegration ? describe : describe.skip;

describe024d("integration: store fulfillment & order readiness (Task 024D)", () => {
  let db: DatabaseClient;
  let app: ReturnType<typeof createApp>;
  const emailSender = createCapturingEmailSender();

  beforeAll(() => {
    const url = process.env.INTEGRATION_DATABASE_URL?.trim();
    if (!url) throw new Error("INTEGRATION_DATABASE_URL required");
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

  it("T024D-01 fulfillment-policy documents NOT_CONFIGURED methods", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "024d-policy");
    const res = await request(app)
      .get("/v1/store/fulfillment-policy")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.fulfillment.domain).toBe("PHYSICAL_MERCHANDISE_ORDER");
    expect(res.body.data.fulfillment.checkout.status).toBe("UNAVAILABLE");
    expect(
      res.body.data.fulfillment.methods.some((m: { method: string }) => m.method === "ACTIVITY_PICKUP"),
    ).toBe(true);
  });

  it("T024D-02 stale stock cart blocks orderReadiness", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "024d-stock");
    const category = await db.storeCategory.findFirst({ where: { slug: "cycling" } });
    const variantId = randomUUID();
    const productId = randomUUID();
    await db.storeProduct.create({
      data: {
        id: productId,
        slug: `024d-${Date.now()}`,
        title: "024D Stock",
        description: "x",
        categoryId: category!.id,
        status: "PUBLISHED",
        variants: {
          create: {
            id: variantId,
            sku: `SKU-024D-${Date.now()}`,
            priceCents: 1000,
            currency: "USD",
            stockQuantity: 5,
            isActive: true,
          },
        },
      },
    });
    await request(app)
      .put(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ quantity: 4 });
    await db.storeProductVariant.update({
      where: { id: variantId },
      data: { stockQuantity: 1 },
    });
    const cart = await request(app)
      .get("/v1/me/store/cart")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(cart.body.data.orderReadiness.cartLinesOrderEligible).toBe(false);
    expect(cart.body.data.orderReadiness.reasonCode).toBe("CART_LINES_NOT_ORDER_READY");
    expect(cart.body.data.checkout.status).toBe("UNAVAILABLE");
    await request(app)
      .delete(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
  });
});
