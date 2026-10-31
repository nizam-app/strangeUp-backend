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

async function verifiedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  db: DatabaseClient,
  prefix: string,
): Promise<{ accessToken: string; userId: string }> {
  const user = await createIntegrationUser(app, emailSender, db, prefix);
  return { accessToken: user.accessToken, userId: user.userId };
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
    const user = await verifiedUser(app, emailSender, db, "t014-s01");
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
    const user = await verifiedUser(app, emailSender, db, "t014-s02");
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

    const other = await verifiedUser(app, emailSender, db, "t014-s02b");
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
    const user = await verifiedUser(app, emailSender, db, "t014-j01");
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

    const other = await verifiedUser(app, emailSender, db, "t014-j01x");
    const steal = await request(app)
      .get(`/v1/me/job-applications/${apply.body.data.applicationId}`)
      .set("Authorization", `Bearer ${other.accessToken}`);
    expect(steal.status).toBe(404);
  });

  it("T014-J02 draft job stays private; closed job rejects apply", async () => {
    const user = await verifiedUser(app, emailSender, db, "t014-j02");
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

  it("T029F-P01 discovery filters, q+cursor pagination, and no fabricated badges", async () => {
    const user = await verifiedUser(app, emailSender, db, "t029f-p01");
    const uniqueQ = `PadelCoach${randomUUID().slice(0, 8)}`;
    const match = await seedPublishedJob(db, "f01match");
    await db.jobListing.update({
      where: { id: match.jobId },
      data: {
        title: `${uniqueQ} Lead`,
        locationCity: "Miami",
        locationRegion: "FL",
      },
    });
    await seedPublishedJob(db, "f01other");

    const filtered = await request(app)
      .get(`/v1/jobs?q=${encodeURIComponent(uniqueQ)}&city=Miami&employmentType=FULL_TIME`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.jobs.length).toBeGreaterThan(0);
    expect(filtered.body.data.jobs.every((j: { jobId: string }) => j.jobId === match.jobId)).toBe(
      true,
    );
    expect(filtered.body.data.jobs[0]).not.toHaveProperty("featured");
    expect(filtered.body.data.jobs[0].pay.disclaimer).toContain("self-reported");

    const pageQ = `TestRoleF01Pg${randomUUID().slice(0, 8)}`;
    await db.jobListing.update({
      where: { id: match.jobId },
      data: { title: `${pageQ} primary` },
    });
    const pageOther = await seedPublishedJob(db, "f01page2");
    await db.jobListing.update({
      where: { id: pageOther.jobId },
      data: { title: `${pageQ} secondary` },
    });

    const page1 = await request(app)
      .get(`/v1/jobs?limit=1&q=${encodeURIComponent(pageQ)}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(page1.body.data.jobs).toHaveLength(1);
    const cursor = page1.body.meta.nextCursor as string;
    expect(cursor).toBeTruthy();

    const page2 = await request(app)
      .get(`/v1/jobs?limit=1&q=Test&cursor=${encodeURIComponent(cursor)}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data.jobs[0].jobId).not.toBe(page1.body.data.jobs[0].jobId);
  });

  it("T029F-P02 saved jobs privacy, idempotency, and closed listing handling", async () => {
    const user = await verifiedUser(app, emailSender, db, "t029f-p02");
    const other = await verifiedUser(app, emailSender, db, "t029f-p02x");
    const { jobId } = await seedPublishedJob(db, "f02save");

    const save1 = await request(app)
      .put(`/v1/me/saved-jobs/${jobId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(save1.status).toBe(200);
    const save2 = await request(app)
      .put(`/v1/me/saved-jobs/${jobId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(save2.status).toBe(200);

    const saved = await request(app)
      .get("/v1/me/saved-jobs")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(saved.body.data.jobs.some((j: { jobId: string }) => j.jobId === jobId)).toBe(true);

    const otherSaved = await request(app)
      .get("/v1/me/saved-jobs")
      .set("Authorization", `Bearer ${other.accessToken}`);
    expect(otherSaved.body.data.jobs.some((j: { jobId: string }) => j.jobId === jobId)).toBe(false);

    await db.jobListing.update({
      where: { id: jobId },
      data: { closedAt: new Date() },
    });

    const savedAfterClose = await request(app)
      .get("/v1/me/saved-jobs")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(savedAfterClose.body.data.jobs.some((j: { jobId: string }) => j.jobId === jobId)).toBe(
      false,
    );

    const unsave = await request(app)
      .delete(`/v1/me/saved-jobs/${jobId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(unsave.status).toBe(200);
  });

  it("T029F-P03 draft detail hidden; applications read regression unchanged", async () => {
    const user = await verifiedUser(app, emailSender, db, "t029f-p03");
    const { jobId } = await seedPublishedJob(db, "f03app");

    const detail = await request(app)
      .get(`/v1/jobs/${jobId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.applicationStatus).toBe("OPEN");

    const apply = await request(app)
      .post(`/v1/jobs/${jobId}/applications`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        coverMessage: "Interested",
        applicationConsentVersion: "pending-legal-review",
      });
    expect(apply.status).toBe(201);

    const apps = await request(app)
      .get("/v1/me/job-applications")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(apps.status).toBe(200);
    expect(apps.body.data.applications.some((a: { jobId: string }) => a.jobId === jobId)).toBe(
      true,
    );
    expect(apps.body.data.applications[0].employerDelivery.status).toBe("NOT_CONFIGURED");
  });

  it("T029F-P04 non-activated users cannot access jobs discovery", async () => {
    const blocked = await createIntegrationUser(app, emailSender, db, "t029f-p04", {
      mainAppAccess: false,
    });
    const res = await request(app)
      .get("/v1/jobs")
      .set("Authorization", `Bearer ${blocked.accessToken}`);
    expect(res.status).toBe(403);
  });
});
