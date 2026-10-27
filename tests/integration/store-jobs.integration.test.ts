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
import {
  createCapturingEmailSender,
  extractVerificationTokenFromText,
} from "../helpers/capturing-email-sender.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

const defaultConsents = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

async function verifiedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  prefix: string,
): Promise<{ accessToken: string; userId: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const register = await request(app).post("/v1/auth/register").send({
    firstName: "Store",
    lastName: "Jobs",
    email,
    password: "ValidPass1",
    dateOfBirth: "1995-06-15",
    consents: defaultConsents,
  });
  expect(register.status).toBe(201);
  const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
  await request(app).post("/v1/auth/email-verification/confirm").send({ token });
  const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
  expect(login.status).toBe(200);
  return {
    accessToken: login.body.data.accessToken as string,
    userId: login.body.data.user.id as string,
  };
}

async function seedPublishedProduct(db: DatabaseClient, tag: string) {
  const category = await db.storeCategory.findFirst({ where: { slug: "cycling" } });
  if (!category) {
    throw new Error("Expected cycling category from migration");
  }
  const productId = randomUUID();
  const variantId = randomUUID();
  const slug = `test-product-${tag}-${Date.now()}`;
  await db.storeProduct.create({
    data: {
      id: productId,
      slug,
      title: `Test Jersey ${tag}`,
      description: "Synthetic integration fixture",
      categoryId: category.id,
      status: "PUBLISHED",
      variants: {
        create: {
          id: variantId,
          sku: `SKU-${tag}-${Date.now()}`,
          sizeLabel: "M",
          colorLabel: "Black",
          priceCents: 4500,
          compareAtPriceCents: 5500,
          currency: "USD",
          stockQuantity: 5,
          isActive: true,
        },
      },
    },
  });
  return { productId, variantId, slug };
}

async function seedPublishedJob(db: DatabaseClient, tag: string) {
  const jobId = randomUUID();
  await db.jobListing.create({
    data: {
      id: jobId,
      title: `Test Role ${tag}`,
      description: "Synthetic integration fixture",
      companyDisplayName: "Fixture Co",
      locationCity: "Austin",
      locationRegion: "TX",
      workMode: "HYBRID",
      employmentType: "FULL_TIME",
      payMinCents: 50000_00,
      payMaxCents: 70000_00,
      payCurrency: "USD",
      payPeriod: "ANNUAL",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  return { jobId };
}

const describeStoreJobs = runIntegration ? describe : describe.skip;

describeStoreJobs("integration: store & jobs (Task 014)", () => {
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

  it("T014-S01 categories list and empty published catalog is valid", async () => {
    const user = await verifiedUser(app, emailSender, "t014-s01");
    const categories = await request(app)
      .get("/v1/store/categories")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(categories.status).toBe(200);
    expect(
      categories.body.data.categories.some((c: { slug: string }) => c.slug === "cycling"),
    ).toBe(true);

    const products = await request(app)
      .get("/v1/store/products")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(products.status).toBe(200);
    expect(Array.isArray(products.body.data.products)).toBe(true);
  });

  it("T014-S02 favorites, cart, checkout unavailable, stock validation", async () => {
    const user = await verifiedUser(app, emailSender, "t014-s02");
    const { productId, variantId } = await seedPublishedProduct(db, "s02");

    const fav = await request(app)
      .put(`/v1/me/store/favorites/${productId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(fav.status).toBe(200);

    const overStock = await request(app)
      .put(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ quantity: 99 });
    expect(overStock.status).toBe(400);

    const add = await request(app)
      .put(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ quantity: 2 });
    expect(add.status).toBe(200);
    expect(add.body.data.subtotalCents).toBe(9000);
    expect(add.body.data.checkout.status).toBe("UNAVAILABLE");

    const other = await verifiedUser(app, emailSender, "t014-s02b");
    const steal = await request(app)
      .get("/v1/me/store/cart")
      .set("Authorization", `Bearer ${other.accessToken}`);
    expect(steal.status).toBe(200);
    expect(steal.body.data.items).toHaveLength(0);

    await request(app)
      .delete(`/v1/me/store/cart/items/${variantId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
  });

  it("T014-J01 job discovery, save, duplicate application conflict", async () => {
    const user = await verifiedUser(app, emailSender, "t014-j01");
    const { jobId } = await seedPublishedJob(db, "j01");

    const list = await request(app)
      .get("/v1/jobs")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.jobs.some((j: { jobId: string }) => j.jobId === jobId)).toBe(true);
    expect(list.body.data.jobs[0]).not.toHaveProperty("applicantCount");

    await request(app)
      .put(`/v1/me/saved-jobs/${jobId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);

    const apply = await request(app)
      .post(`/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        coverMessage: "I would like to apply",
        applicationConsentVersion: "pending-legal-review",
      });
    expect(apply.status).toBe(201);
    expect(apply.body.data.employerDelivery.status).toBe("NOT_CONFIGURED");

    const dup = await request(app)
      .post(`/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        coverMessage: "Second try",
        applicationConsentVersion: "pending-legal-review",
      });
    expect(dup.status).toBe(409);

    const other = await verifiedUser(app, emailSender, "t014-j01x");
    const steal = await request(app)
      .get(`/v1/me/job-applications/${apply.body.data.applicationId}`)
      .set("Authorization", `Bearer ${other.accessToken}`);
    expect(steal.status).toBe(404);
  });

  it("T014-J02 draft job stays private; closed job rejects apply", async () => {
    const user = await verifiedUser(app, emailSender, "t014-j02");
    const draft = await request(app)
      .post("/v1/me/job-listings")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        title: "Private draft",
        description: "Not published",
        companyDisplayName: "Draft Co",
        employmentType: "CONTRACT",
      });
    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe("DRAFT");
    const draftId = draft.body.data.jobId as string;

    const publicList = await request(app)
      .get("/v1/jobs")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(publicList.body.data.jobs.some((j: { jobId: string }) => j.jobId === draftId)).toBe(
      false,
    );

    const { jobId: closedId } = await seedPublishedJob(db, "j02closed");
    await db.jobListing.update({
      where: { id: closedId },
      data: { closedAt: new Date() },
    });

    const closedApply = await request(app)
      .post(`/v1/jobs/${closedId}/applications`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        coverMessage: "Too late",
        applicationConsentVersion: "pending-legal-review",
      });
    expect(closedApply.status).toBe(404);
  });
});
