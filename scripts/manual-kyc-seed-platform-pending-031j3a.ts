/** Add one Step B platform-pending row alongside manual Step A (031J-3A verification). */
import { loadEnv } from "../src/config/env.js";
import { createPrismaClient, disconnectPrisma } from "../src/infrastructure/database/prisma.js";
import { loadManualKycTestProcessEnv } from "./manual-kyc-test-config.js";
import { resolveManualKycTestDatabaseUrl } from "../tests/setup/integration-database-guard.js";
import { clearRateLimits } from "../src/modules/auth/rate-limit.js";
const BASE = "http://127.0.0.1:3010";
const MANUAL = "/v1/me/verification/manual";
const PASSWORD = "ValidPass1";
const MIN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVRIQ2P8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = (await res.json()) as { data?: { accessToken?: string } };
  const token = body.data?.accessToken;
  if (!token) {
    throw new Error(`login failed for ${email}`);
  }
  return token;
}

async function main(): Promise<void> {
  loadManualKycTestProcessEnv();
  const databaseUrl = resolveManualKycTestDatabaseUrl(process.env);
  process.env.DATABASE_URL = databaseUrl;
  loadEnv();
  clearRateLimits();
  const db = createPrismaClient(databaseUrl);

  const reviewerEmail = process.argv[2];
  if (!reviewerEmail) {
    throw new Error("Usage: tsx script.ts <reviewer-email-from-seed>");
  }
  const reviewerToken = await login(reviewerEmail);

  const email = `platform-pending-${Date.now()}-031j3a@example.com`;
  const reg = await fetch(`${BASE}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Platform",
      lastName: "Pending",
      email,
      password: PASSWORD,
      dateOfBirth: "1995-06-15",
      consents: [
        { type: "TERMS", version: "pending-legal-review" },
        { type: "PRIVACY", version: "pending-legal-review" },
        { type: "AGE_ATTESTATION", version: "pending-legal-review" },
      ],
    }),
  });
  if (reg.status !== 201) {
    throw new Error(`register ${reg.status}`);
  }
  const user = await db.user.findFirst({
    where: { emailNormalized: email.toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    throw new Error("user missing");
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      accountStatus: "ACTIVE",
      ageEligibilityStatus: "ELIGIBLE",
    },
  });
  const applicantToken = await login(email);

  const start = await fetch(`${BASE}${MANUAL}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${applicantToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ idDocumentType: "PASSPORT" }),
  });
  const startBody = (await start.json()) as { data?: { sessionId?: string } };
  const sessionId = startBody.data?.sessionId;
  if (!sessionId) {
    throw new Error("no session");
  }
  for (const kind of ["ID_DOCUMENT", "SELFIE"] as const) {
    const form = new FormData();
    form.set("kind", kind);
    form.set("evidence", new Blob([MIN_PNG], { type: "image/png" }), "synthetic.png");
    const up = await fetch(`${BASE}${MANUAL}/sessions/${sessionId}/evidence`, {
      method: "POST",
      headers: { Authorization: `Bearer ${applicantToken}` },
      body: form,
    });
    if (up.status !== 201) {
      throw new Error(`upload ${kind} ${up.status}`);
    }
  }

  const stepA = await fetch(
    `${BASE}/v1/admin/identity-reviews/${user.id}/manual-identity-decision`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${reviewerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision: "APPROVE", reasonCode: "SEED_031J3A_PLATFORM" }),
    },
  );
  if (stepA.status !== 200) {
    throw new Error(`step A ${stepA.status}`);
  }

  const list = await fetch(
    `${BASE}/v1/admin/identity-reviews?status=PENDING&posture=all&limit=50`,
    {
      headers: { Authorization: `Bearer ${reviewerToken}` },
    },
  );
  const listBody = (await list.json()) as {
    data?: { reviews?: { reviewId: string; pendingReviewLabel?: string }[] };
  };
  const reviews = listBody.data?.reviews ?? [];
  console.log(
    JSON.stringify({
      platformReviewId: user.id,
      pendingCount: reviews.length,
      labels: reviews.map((r) => ({ id: r.reviewId, label: r.pendingReviewLabel })),
    }),
  );
  await disconnectPrisma();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
