/**
 * Task 031J-3A — seed one fresh MANUAL IN_REVIEW applicant + reviewer for Pending queue UI check.
 * Requires test API on :3010. Logs synthetic emails only (no secrets/URLs).
 */
import { loadEnv } from "../src/config/env.js";
import {
  createPrismaClient,
  disconnectPrisma,
  type DatabaseClient,
} from "../src/infrastructure/database/prisma.js";
import { grantIdentityReviewer } from "../tests/helpers/kyc-applicant.js";
import { loadManualKycTestProcessEnv } from "./manual-kyc-test-config.js";
import { resolveManualKycTestDatabaseUrl } from "../tests/setup/integration-database-guard.js";
import { clearRateLimits } from "../src/modules/auth/rate-limit.js";
import { manualIdentityReviewPendingCriteria } from "../src/modules/admin/identity-admin-review-pending-eligibility.js";

const BASE = "http://127.0.0.1:3010";
const MANUAL = "/v1/me/verification/manual";
const PASSWORD = "ValidPass1";
const MIN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVRIQ2P8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const CONSENTS = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

async function jsonFetch(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(init.headers);
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }
  if (init.body && !headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function registerVerifiedUser(
  db: DatabaseClient,
  prefix: string,
): Promise<{ userId: string; token: string; email: string }> {
  const email = `${prefix}-${Date.now()}-031j3a@example.com`;
  const reg = await jsonFetch("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Pending",
      lastName: "Queue",
      email,
      password: PASSWORD,
      dateOfBirth: "1995-06-15",
      consents: CONSENTS,
    }),
  });
  if (reg.status !== 201) {
    throw new Error(`register failed: ${reg.status}`);
  }
  const login0 = await jsonFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const userId = (login0.body as { data?: { user?: { id?: string } } })?.data?.user?.id;
  if (!userId) {
    throw new Error("missing user id after register");
  }
  await db.user.update({
    where: { id: userId },
    data: {
      emailVerifiedAt: new Date(),
      accountStatus: "ACTIVE",
      ageEligibilityStatus: "ELIGIBLE",
    },
  });
  const login = await jsonFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const token = (login.body as { data?: { accessToken?: string } })?.data?.accessToken;
  if (!token) {
    throw new Error("missing access token");
  }
  return { userId, token, email };
}

async function uploadEvidence(token: string, sessionId: string, kind: string): Promise<void> {
  const form = new FormData();
  form.set("kind", kind);
  form.set("evidence", new Blob([MIN_PNG], { type: "image/png" }), "synthetic-test.png");
  const res = await fetch(`${BASE}${MANUAL}/sessions/${sessionId}/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (res.status !== 201) {
    throw new Error(`upload ${kind} failed: ${res.status}`);
  }
}

async function main(): Promise<void> {
  loadManualKycTestProcessEnv();
  const databaseUrl = resolveManualKycTestDatabaseUrl(process.env);
  process.env.DATABASE_URL = databaseUrl;
  loadEnv();
  clearRateLimits();
  const db = createPrismaClient(databaseUrl);

  const health = await jsonFetch("/health/live");
  if (health.status !== 200) {
    throw new Error(`API not ready on :3010 (status ${health.status})`);
  }

  const reviewer = await registerVerifiedUser(db, "reviewer-031j3a");
  await grantIdentityReviewer(db, reviewer.userId);

  const applicant = await registerVerifiedUser(db, "manual-pending-031j3a");
  const start = await jsonFetch(`${MANUAL}/sessions`, {
    method: "POST",
    token: applicant.token,
    body: JSON.stringify({ idDocumentType: "PASSPORT" }),
  });
  const sessionId = (start.body as { data?: { sessionId?: string } })?.data?.sessionId;
  if (start.status !== 201 || !sessionId) {
    throw new Error(`manual session start failed: ${start.status}`);
  }
  await uploadEvidence(applicant.token, sessionId, "ID_DOCUMENT");
  await uploadEvidence(applicant.token, sessionId, "SELFIE");

  const session = await jsonFetch(`${MANUAL}/sessions/${sessionId}`, { token: applicant.token });
  const data = (session.body as { data?: { status?: string; evidenceComplete?: boolean } })?.data;
  if (data?.status !== "IN_REVIEW" || data?.evidenceComplete !== true) {
    throw new Error(`expected IN_REVIEW complete session, got ${JSON.stringify(data)}`);
  }

  const summary = await jsonFetch("/v1/admin/identity-reviews/summary", { token: reviewer.token });
  const listAll = await jsonFetch(
    "/v1/admin/identity-reviews?status=PENDING&posture=all&limit=50",
    {
      token: reviewer.token,
    },
  );
  const listActionable = await jsonFetch(
    "/v1/admin/identity-reviews?status=PENDING&posture=actionable&limit=50",
    { token: reviewer.token },
  );

  type ReviewRow = {
    reviewId: string;
    pendingReviewLabel?: string | null;
    pendingReviewStage?: string | null;
    submittedAt?: string | null;
    adminReviewStatus?: string;
  };
  const reviewsAll = (listAll.body as { data?: { reviews?: ReviewRow[] } })?.data?.reviews ?? [];
  const matches = reviewsAll.filter((r) => r.reviewId === applicant.userId);
  const manualEligible = await db.user.count({ where: manualIdentityReviewPendingCriteria() });

  const expiredSessionUserId = "d345a633-6438-43ee-b721-54d8631a6f85";
  const expiredListed = reviewsAll.some((r) => r.reviewId === expiredSessionUserId);

  console.log(
    JSON.stringify(
      {
        reviewerLogin: { email: reviewer.email, password: PASSWORD },
        applicantReviewId: applicant.userId,
        sessionStatus: data.status,
        manualEligibleCount: manualEligible,
        summary: (summary.body as { data?: unknown })?.data,
        applicantRowsInPendingAll: matches.length,
        applicantPendingLabel: matches[0]?.pendingReviewLabel ?? null,
        applicantPendingStage: matches[0]?.pendingReviewStage ?? null,
        applicantSubmittedAt: matches[0]?.submittedAt ?? null,
        inActionablePosture: (
          (listActionable.body as { data?: { reviews?: ReviewRow[] } })?.data?.reviews ?? []
        ).some((r) => r.reviewId === applicant.userId),
        expiredSyntheticExcluded: !expiredListed,
        platformRowsInPendingAll: reviewsAll.filter(
          (r) => r.pendingReviewStage === "PLATFORM_ACTIVATION",
        ).length,
        adminDetailPath: `/verification/${applicant.userId}`,
      },
      null,
      2,
    ),
  );

  await disconnectPrisma();
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
