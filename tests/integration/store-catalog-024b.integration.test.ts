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
import { upsertStaffGrant } from "../../src/modules/admin/platform-staff-bootstrap.js";
import {
  IDENTITY_REVIEWER_ROLE,
  STORE_CATALOG_MANAGER_ROLE,
} from "../../src/modules/admin/platform-staff-policy.js";
import { createCapturingEmailSender } from "../helpers/capturing-email-sender.js";
import { createIntegrationUser } from "../helpers/integration-user.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const describe024b = runIntegration ? describe : describe.skip;

describe024b("integration: store catalog admin (Task 024B)", () => {
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
      STORE_CATALOG_MANAGEMENT_ENABLED: "true",
    });
    app = createApp({
      env,
      logger: pino({ level: "silent" }),
      db,
      emailSender,
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(() => {
    clearRateLimits();
    emailSender.clear();
  });

  async function catalogManager(prefix: string) {
    const user = await createIntegrationUser(app, emailSender, db, prefix);
    await upsertStaffGrant(db, user.userId, STORE_CATALOG_MANAGER_ROLE, null);
    return user;
  }

  it("T024B-01 feature disabled returns FEATURE_DISABLED", async () => {
    const url = process.env.INTEGRATION_DATABASE_URL!.trim();
    const disabledEnv = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: url,
      CORS_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
      PROFILE_UPLOAD_DIR: ".data/test-avatars",
      ACTIVITY_UPLOAD_DIR: ".data/test-activity-media",
      GROUP_UPLOAD_DIR: ".data/test-group-media",
      STORE_UPLOAD_DIR: ".data/test-store-media",
      STORE_CATALOG_MANAGEMENT_ENABLED: "false",
    });
    const disabledApp = createApp({
      env: disabledEnv,
      logger: pino({ level: "silent" }),
      db,
      emailSender,
    });
    const mgr = await catalogManager("024b-disabled");
    const res = await request(disabledApp)
      .get("/v1/admin/store-catalog/products")
      .set("Authorization", `Bearer ${mgr.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FEATURE_DISABLED");
  });

  it("T024B-02 identity reviewer without catalog role is forbidden", async () => {
    const reviewer = await createIntegrationUser(app, emailSender, db, "024b-reviewer");
    await upsertStaffGrant(db, reviewer.userId, IDENTITY_REVIEWER_ROLE, null);
    const res = await request(app)
      .get("/v1/admin/store-catalog/products")
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("T024B-03 create, image, variant, publish; buyer sees product; checkout UNAVAILABLE", async () => {
    const mgr = await catalogManager("024b-flow");
    const buyer = await createIntegrationUser(app, emailSender, db, "024b-buyer");
    const slug = `024b-jersey-${Date.now()}`;

    const created = await request(app)
      .post("/v1/admin/store-catalog/products")
      .set("Authorization", `Bearer ${mgr.accessToken}`)
      .send({
        slug,
        title: "024B Test Jersey",
        description: "Catalog admin fixture",
        categorySlug: "cycling",
      });
    expect(created.status).toBe(201);
    const productId = created.body.data.productId as string;

    const image = await request(app)
      .post(`/v1/admin/store-catalog/products/${productId}/images`)
      .set("Authorization", `Bearer ${mgr.accessToken}`)
      .attach("image", TINY_PNG, "product.png");
    expect(image.status).toBe(201);

    const variant = await request(app)
      .post(`/v1/admin/store-catalog/products/${productId}/variants`)
      .set("Authorization", `Bearer ${mgr.accessToken}`)
      .send({
        sku: `SKU-024B-${Date.now()}`,
        sizeLabel: "M",
        colorLabel: "Black",
        priceCents: 4500,
        currency: "USD",
        stockQuantity: 8,
      });
    expect(variant.status).toBe(201);
    const variantId = variant.body.data.variants[0].variantId as string;

    const publishFail = await request(app)
      .post(`/v1/admin/store-catalog/products/${productId}/publish`)
      .set("Authorization", `Bearer ${mgr.accessToken}`);
    expect(publishFail.status).toBe(200);

    const publicDetail = await request(app)
      .get(`/v1/store/products/${productId}`)
      .set("Authorization", `Bearer ${buyer.accessToken}`);
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.body.data.slug).toBe(slug);

    const cart = await request(app)
      .put(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .send({ quantity: 2 });
    expect(cart.status).toBe(200);
    expect(cart.body.data.checkout.status).toBe("UNAVAILABLE");

    await request(app)
      .delete(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${buyer.accessToken}`);
  });

  it("T024B-04 stock patch concurrency conflict", async () => {
    const mgr = await catalogManager("024b-stock");
    const slug = `024b-stock-${Date.now()}`;
    const created = await request(app)
      .post("/v1/admin/store-catalog/products")
      .set("Authorization", `Bearer ${mgr.accessToken}`)
      .send({
        slug,
        title: "Stock test",
        description: "Stock concurrency",
        categorySlug: "cycling",
      });
    const productId = created.body.data.productId as string;
    await request(app)
      .post(`/v1/admin/store-catalog/products/${productId}/images`)
      .set("Authorization", `Bearer ${mgr.accessToken}`)
      .attach("image", TINY_PNG, "product.png");
    const withVariant = await request(app)
      .post(`/v1/admin/store-catalog/products/${productId}/variants`)
      .set("Authorization", `Bearer ${mgr.accessToken}`)
      .send({
        sku: `SKU-ST-${Date.now()}`,
        priceCents: 1000,
        stockQuantity: 3,
      });
    const variantId = withVariant.body.data.variants[0].variantId as string;
    const staleUpdatedAt = "2000-01-01T00:00:00.000Z";
    const conflict = await request(app)
      .patch(`/v1/admin/store-catalog/products/${productId}/variants/${variantId}/stock`)
      .set("Authorization", `Bearer ${mgr.accessToken}`)
      .send({ stockQuantity: 2, expectedUpdatedAt: staleUpdatedAt });
    expect(conflict.status).toBe(409);
  });
});
