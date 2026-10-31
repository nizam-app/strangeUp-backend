/**
 * Task 031J-2 — bounded Manual KYC smoke against localhost:3010 + strangeup_test only.
 * Never logs secrets, connection URLs, or Cloudinary public IDs.
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
import {
  hasHomeAccess,
  toActivationPolicyActor,
} from "../src/modules/policy/effective-access-policy.js";
import { clearRateLimits } from "../src/modules/auth/rate-limit.js";

const BASE = "http://127.0.0.1:3010";
const MANUAL = "/v1/me/verification/manual";
const MIN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAD0lEQVRIQ2P8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const CONSENTS = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

type StepResult = { name: string; ok: boolean; detail?: string };

const results: StepResult[] = [];

function record(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function jsonFetch(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: unknown; text: string }> {
  const headers = new Headers(init.headers);
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }
  if (init.body && !headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body = parseJsonBody(text);
  return { status: res.status, body, text };
}

function parseJsonBody(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function registerVerifiedUser(
  db: DatabaseClient,
  prefix: string,
): Promise<{ userId: string; token: string; email: string }> {
  const email = `${prefix}-${Date.now()}-031j2@example.com`;
  const password = "ValidPass1";
  const reg = await jsonFetch("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: "Synth",
      lastName: "Test",
      email,
      password,
      dateOfBirth: "1995-06-15",
      consents: CONSENTS,
    }),
  });
  if (reg.status !== 201) {
    throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  }
  const login0 = await jsonFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const userId = (login0.body as { data?: { user?: { id?: string } } })?.data?.user?.id;
  if (login0.status !== 200 || !userId) {
    throw new Error(`login after register failed: ${login0.status} ${JSON.stringify(login0.body)}`);
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
    body: JSON.stringify({ email, password }),
  });
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status}`);
  }
  const token = (login.body as { data?: { accessToken?: string } })?.data?.accessToken;
  if (!token) {
    throw new Error("missing access token");
  }
  return { userId, token, email };
}

async function uploadEvidence(
  token: string,
  sessionId: string,
  kind: string,
): Promise<{ status: number; body: unknown }> {
  const form = new FormData();
  form.set("kind", kind);
  form.set("evidence", new Blob([MIN_PNG], { type: "image/png" }), "synthetic-test.png");
  const res = await fetch(`${BASE}${MANUAL}/sessions/${sessionId}/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  return { status: res.status, body: parseJsonBody(text) };
}

function assertNoCloudinaryLeak(payload: unknown): boolean {
  const s = JSON.stringify(payload);
  return (
    !s.includes("cloudinary.com") &&
    !s.includes("cloudinaryPublicId") &&
    !s.includes("res.cloudinary")
  );
}

async function runApplicantFlow(
  db: DatabaseClient,
  prefix: string,
  docType: "NATIONAL_ID" | "PASSPORT",
): Promise<{ userId: string; token: string; sessionId: string; evidenceId: string }> {
  const user = await registerVerifiedUser(db, prefix);
  const startBody =
    docType === "PASSPORT"
      ? { idDocumentType: "PASSPORT" }
      : { idDocumentType: "NATIONAL_ID", documentHasRearSide: true };
  const start = await jsonFetch(`${MANUAL}/sessions`, {
    method: "POST",
    token: user.token,
    body: JSON.stringify(startBody),
  });
  if (start.status !== 201) {
    throw new Error(`start session failed: ${start.status}`);
  }
  const sessionId = (start.body as { data?: { sessionId?: string } })?.data?.sessionId;
  if (!sessionId) {
    throw new Error("missing sessionId");
  }
  record(`${prefix}: session start`, assertNoCloudinaryLeak(start.body));

  const kinds =
    docType === "PASSPORT"
      ? (["ID_DOCUMENT", "SELFIE"] as const)
      : (["ID_DOCUMENT", "ID_DOCUMENT_BACK", "SELFIE"] as const);

  let lastEvidenceId = "";
  for (const kind of kinds) {
    const up = await uploadEvidence(user.token, sessionId, kind);
    record(`${prefix}: upload ${kind}`, up.status === 201 && assertNoCloudinaryLeak(up.body));
    if (up.status !== 201) {
      throw new Error(`upload ${kind} failed: ${up.status}`);
    }
    lastEvidenceId =
      (up.body as { data?: { evidenceId?: string } })?.data?.evidenceId ?? lastEvidenceId;
  }

  const session = await jsonFetch(`${MANUAL}/sessions/${sessionId}`, {
    token: user.token,
  });
  const complete = (session.body as { data?: { evidenceComplete?: boolean } })?.data
    ?.evidenceComplete;
  record(`${prefix}: evidence complete`, complete === true);
  record(`${prefix}: session JSON leak check`, assertNoCloudinaryLeak(session.body));

  return { userId: user.userId, token: user.token, sessionId, evidenceId: lastEvidenceId };
}

async function main(): Promise<void> {
  const envRaw = loadManualKycTestProcessEnv();
  const databaseUrl = resolveManualKycTestDatabaseUrl(envRaw);
  process.env.DATABASE_URL = databaseUrl;
  const env = loadEnv();
  const db = createPrismaClient(databaseUrl);

  try {
    clearRateLimits();
    const health = await jsonFetch("/health/live");
    record("API health/live", health.status === 200, `status ${health.status}`);

    const reviewer = await registerVerifiedUser(db, "reviewer");
    await grantIdentityReviewer(db, reviewer.userId);

    const partial = await registerVerifiedUser(db, "partial-evidence");
    const partialStart = await jsonFetch(`${MANUAL}/sessions`, {
      method: "POST",
      token: partial.token,
      body: JSON.stringify({ idDocumentType: "NATIONAL_ID", documentHasRearSide: true }),
    });
    const partialSessionId = (partialStart.body as { data?: { sessionId?: string } })?.data
      ?.sessionId;
    if (!partialSessionId) {
      throw new Error("partial session missing");
    }
    await uploadEvidence(partial.token, partialSessionId, "ID_DOCUMENT");
    const badMime = await (async () => {
      const form = new FormData();
      form.set("kind", "SELFIE");
      form.set("evidence", new Blob(["not-an-image"], { type: "text/plain" }), "bad.txt");
      const res = await fetch(`${BASE}${MANUAL}/sessions/${partialSessionId}/evidence`, {
        method: "POST",
        headers: { Authorization: `Bearer ${partial.token}` },
        body: form,
      });
      return res.status;
    })();
    record("Failed upload mime", badMime === 400);
    const incompleteApprove = await jsonFetch(
      `/v1/admin/identity-reviews/${partial.userId}/manual-identity-decision`,
      {
        method: "POST",
        token: reviewer.token,
        body: JSON.stringify({ decision: "APPROVE", reasonCode: "SMOKE_INCOMPLETE" }),
      },
    );
    record("Incomplete evidence Step A blocked", incompleteApprove.status === 409);

    const applicant = await runApplicantFlow(db, "dl-flow", "NATIONAL_ID");
    await runApplicantFlow(db, "passport-flow", "PASSPORT");

    const uiHold = await runApplicantFlow(db, "ui-hold", "NATIONAL_ID");

    const homeBefore = await jsonFetch("/v1/home", { token: applicant.token });
    record("Home before Step A+B", homeBefore.status === 403, `status ${homeBefore.status}`);

    const listBefore = await jsonFetch("/v1/admin/identity-reviews?status=PENDING", {
      token: reviewer.token,
    });
    record("Admin list (reviewer)", listBefore.status === 200);

    const unauthEvidence = await jsonFetch(
      `/v1/admin/identity-reviews/${applicant.userId}/manual-evidence`,
    );
    record("Staff evidence unauthenticated", unauthEvidence.status === 401);

    const cross = await jsonFetch(
      `/v1/admin/identity-reviews/${applicant.userId}/manual-evidence/${applicant.evidenceId}`,
      { token: partial.token },
    );
    record("Non-reviewer staff evidence", cross.status === 403);

    const applicantOnStaff = await jsonFetch(
      `/v1/admin/identity-reviews/${uiHold.userId}/manual-evidence`,
      { token: applicant.token },
    );
    record("Applicant token on staff evidence", applicantOnStaff.status === 403);

    const manualList = await jsonFetch(
      `/v1/admin/identity-reviews/${applicant.userId}/manual-evidence`,
      { token: reviewer.token },
    );
    record(
      "Staff manual evidence list",
      manualList.status === 200 && assertNoCloudinaryLeak(manualList.body),
    );
    const items =
      (manualList.body as { data?: { items?: { evidenceId: string }[] } })?.data?.items ?? [];
    const evidenceId = items[0]?.evidenceId ?? applicant.evidenceId;

    const bytes = await fetch(
      `${BASE}/v1/admin/identity-reviews/${applicant.userId}/manual-evidence/${evidenceId}`,
      { headers: { Authorization: `Bearer ${reviewer.token}` } },
    );
    const buf = Buffer.from(await bytes.arrayBuffer());
    const imageBytes =
      bytes.status === 200 &&
      buf.length > 0 &&
      (bytes.headers.get("content-type")?.startsWith("image/") ?? false) &&
      (bytes.headers.get("cache-control")?.includes("no-store") ?? false);
    record("Staff evidence bytes", imageBytes, `status=${bytes.status} bytes=${buf.length}`);

    const deleteSelfie = await jsonFetch(
      `/v1/admin/identity-reviews/${uiHold.userId}/manual-evidence/${uiHold.evidenceId}`,
      { method: "DELETE", token: reviewer.token },
    );
    record("Staff delete evidence", deleteSelfie.status === 204);
    const deletedApprove = await jsonFetch(
      `/v1/admin/identity-reviews/${uiHold.userId}/manual-identity-decision`,
      {
        method: "POST",
        token: reviewer.token,
        body: JSON.stringify({ decision: "APPROVE", reasonCode: "SMOKE_DELETED" }),
      },
    );
    record("Deleted evidence Step A blocked", deletedApprove.status === 409);

    const stepA = await jsonFetch(
      `/v1/admin/identity-reviews/${applicant.userId}/manual-identity-decision`,
      {
        method: "POST",
        token: reviewer.token,
        body: JSON.stringify({ decision: "APPROVE", reasonCode: "SMOKE_031J2" }),
      },
    );
    record(
      "Step A manual identity approve",
      stepA.status === 200 && assertNoCloudinaryLeak(stepA.body),
    );

    const homeMid = await jsonFetch("/v1/home", { token: applicant.token });
    record("Home after Step A only", homeMid.status === 403, `status ${homeMid.status}`);

    const stepB = await jsonFetch(`/v1/admin/identity-reviews/${applicant.userId}/approve`, {
      method: "POST",
      token: reviewer.token,
    });
    record("Step B platform approve", stepB.status === 200);

    const userRow = await db.user.findUniqueOrThrow({ where: { id: applicant.userId } });
    record("Home access after Step B", hasHomeAccess(toActivationPolicyActor(userRow)));

    const veriffStart = await jsonFetch("/v1/me/verification/sessions", {
      method: "POST",
      token: applicant.token,
      body: JSON.stringify({}),
    });
    record(
      "Veriff/provider session inactive",
      veriffStart.status === 403 || veriffStart.status === 503 || veriffStart.status === 409,
      `status ${veriffStart.status}`,
    );

    const badUpload = await uploadEvidence(applicant.token, applicant.sessionId, "ID_DOCUMENT");
    record("Upload after session decided", badUpload.status >= 400 && badUpload.status < 500);

    const row = await db.manualVerificationEvidence.findFirst({
      where: { id: evidenceId },
      select: { cloudinaryPublicId: true },
    });
    if (row?.cloudinaryPublicId && env.CLOUDINARY_CLOUD_NAME) {
      const publicUrl = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/${row.cloudinaryPublicId}.png`;
      const pub = await fetch(publicUrl);
      record("Public Cloudinary delivery blocked", pub.status === 404 || pub.status === 401);
    } else {
      record("Public Cloudinary delivery blocked", false, "missing metadata");
    }

    const rejectHold = await jsonFetch(
      `/v1/admin/identity-reviews/${partial.userId}/manual-identity-decision`,
      {
        method: "POST",
        token: reviewer.token,
        body: JSON.stringify({ decision: "REJECT", reasonCode: "SMOKE_NO_SESSION" }),
      },
    );
    record("Reject on incomplete session", rejectHold.status === 404 || rejectHold.status === 409);

    const failed = results.filter((r) => !r.ok);
    console.log("\n--- Admin UI (synthetic reviewer, strangeup_test only) ---");
    console.log(`reviewerEmail: ${reviewer.email}`);
    console.log("reviewerPassword: ValidPass1");
    console.log(`uiHoldApplicantUserId: ${uiHold.userId}`);

    console.log("\n--- Summary ---");
    console.log(`Passed: ${results.length - failed.length}/${results.length}`);
    if (failed.length) {
      console.log("Failures:", failed.map((f) => f.name).join(", "));
      process.exit(1);
    }
  } finally {
    await disconnectPrisma();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
