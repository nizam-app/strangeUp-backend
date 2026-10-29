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

async function activatedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  db: DatabaseClient,
  prefix: string,
) {
  const user = await createIntegrationUser(app, emailSender, db, prefix);
  return { accessToken: user.accessToken, userId: user.userId };
}

async function seedProduct(
  db: DatabaseClient,
  tag: string,
  opts?: { stockQuantity?: number; status?: "PUBLISHED" | "DRAFT"; isActive?: boolean },
) {
  const category = await db.storeCategory.findFirst({ where: { slug: "cycling" } });
  if (!category) {
    throw new Error("Expected cycling category from migration");
  }
  const productId = randomUUID();
  const variantId = randomUUID();
  const slug = `024a-${tag}-${Date.now()}`;
  await db.storeProduct.create({
    data: {
      id: productId,
      slug,
      title: `024A ${tag}`,
      description: "Cart integrity fixture",
      categoryId: category.id,
      status: opts?.status ?? "PUBLISHED",
      variants: {
        create: {
          id: variantId,
          sku: `SKU-024A-${tag}-${Date.now()}`,
          sizeLabel: "M",
          colorLabel: "Black",
          priceCents: 4500,
          compareAtPriceCents: null,
          currency: "USD",
          stockQuantity: opts?.stockQuantity ?? 10,
          isActive: opts?.isActive ?? true,
        },
      },
    },
  });
  return { productId, variantId };
}

const describe024a = runIntegration ? describe : describe.skip;

describe024a("integration: store cart integrity (Task 024A)", () => {
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

  it("T024A-01 all AVAILABLE lines: subtotal matches eligible and checkout UNAVAILABLE", async () => {
    const user = await activatedUser(app, emailSender, db, "024a-01");
    const { variantId } = await seedProduct(db, "01");
    const res = await request(app)
      .put(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ quantity: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.subtotalCents).toBe(9000);
    expect(res.body.data.linesSubtotalCents).toBe(9000);
    expect(res.body.data.summary.allLinesPurchasable).toBe(true);
    expect(res.body.data.checkout.status).toBe("UNAVAILABLE");
    await request(app)
      .delete(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
  });

  it("T024A-02 stale insufficient stock after catalog shrink", async () => {
    const user = await activatedUser(app, emailSender, db, "024a-02");
    const { variantId } = await seedProduct(db, "02", { stockQuantity: 5 });
    await request(app)
      .put(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ quantity: 4 });
    await db.storeProductVariant.update({
      where: { id: variantId },
      data: { stockQuantity: 2 },
    });
    const cart = await request(app)
      .get("/v1/me/store/cart")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(cart.status).toBe(200);
    const line = cart.body.data.items[0];
    expect(line.availability).toBe("INSUFFICIENT_STOCK");
    expect(line.lineSubtotalCents).toBe(4500 * 4);
    expect(line.eligibleLineSubtotalCents).toBe(4500 * 2);
    expect(cart.body.data.subtotalCents).toBe(4500 * 2);
    expect(cart.body.data.linesSubtotalCents).toBe(4500 * 4);
    expect(cart.body.data.summary.allLinesPurchasable).toBe(false);
    expect(cart.body.data.checkout.status).toBe("UNAVAILABLE");
    await request(app)
      .delete(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
  });

  it("T024A-03 unpublished product line becomes UNAVAILABLE with zero subtotals", async () => {
    const user = await activatedUser(app, emailSender, db, "024a-03");
    const { productId, variantId } = await seedProduct(db, "03");
    await request(app)
      .put(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ quantity: 1 });
    await db.storeProduct.update({
      where: { id: productId },
      data: { status: "DRAFT" },
    });
    const cart = await request(app)
      .get("/v1/me/store/cart")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(cart.body.data.items[0].availability).toBe("UNAVAILABLE");
    expect(cart.body.data.items[0].availabilityReason).toBe("PRODUCT_NOT_PUBLISHED");
    expect(cart.body.data.subtotalCents).toBe(0);
    expect(cart.body.data.summary.hasUnavailableLines).toBe(true);
    await request(app)
      .delete(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
  });

  it("T024A-04 write path rejects over-stock and unpublished variant", async () => {
    const user = await activatedUser(app, emailSender, db, "024a-04");
    const { variantId } = await seedProduct(db, "04", { stockQuantity: 2 });
    const over = await request(app)
      .put(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ quantity: 3 });
    expect(over.status).toBe(400);

    const { productId, variantId: draftVariant } = await seedProduct(db, "04b", {
      status: "DRAFT",
    });
    void productId;
    const draftAdd = await request(app)
      .put(`/v1/me/store/cart/items/${draftVariant}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ quantity: 1 });
    expect(draftAdd.status).toBe(404);
  });

  it("T024A-05 cart isolation between users", async () => {
    const a = await activatedUser(app, emailSender, db, "024a-05a");
    const b = await activatedUser(app, emailSender, db, "024a-05b");
    const { variantId } = await seedProduct(db, "05");
    await request(app)
      .put(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ quantity: 1 });
    const bCart = await request(app)
      .get("/v1/me/store/cart")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(bCart.body.data.items).toHaveLength(0);
    await request(app)
      .delete(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${a.accessToken}`);
  });
});
