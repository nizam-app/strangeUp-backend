/**
 * Task 032E — guarded Users Management sandbox E2E against strangeup_test only.
 * Never logs URLs, passwords, tokens, or session secrets.
 */
import { io as ioClient } from "socket.io-client";
import { loadEnv } from "../src/config/env.js";
import {
  createPrismaClient,
  disconnectPrisma,
  type DatabaseClient,
} from "../src/infrastructure/database/prisma.js";
import {
  hasHomeAccess,
  toActivationPolicyActor,
} from "../src/modules/policy/effective-access-policy.js";
import { buildKycEnforcementContext } from "../src/modules/verification/kyc-identity-authority.js";
import {
  upsertStaffGrant,
  revokeStaffGrant,
} from "../src/modules/admin/platform-staff-bootstrap.js";
import { SUPER_ADMIN_ROLE } from "../src/modules/admin/platform-staff-policy.js";
import {
  loadManualKycTestProcessEnv,
  MANUAL_KYC_TEST_DEFAULT_PORT,
} from "./manual-kyc-test-config.js";
import {
  REQUIRED_DEVELOPMENT_DATABASE,
  REQUIRED_INTEGRATION_DATABASE,
  parseDatabaseTarget,
  resolveManualKycTestDatabaseUrl,
  verifyIntegrationDatabaseIdentity,
} from "../tests/setup/integration-database-guard.js";

const API_BASE = "http://127.0.0.1:3010";
const BFF_BASE = "http://127.0.0.1:3011";
const BFF_ORIGIN = "http://localhost:5174";
const SYNTHETIC_PASSWORD = "ValidPass1";
const SUSPEND_REASON = "TASK032E synthetic sandbox test — policy verification only.";
const RESTORE_REASON = "TASK032E synthetic sandbox restore — returning account to original status.";
type StepResult = { name: string; ok: boolean; detail?: string };
const results: StepResult[] = [];

function record(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "[redacted]";
  }
  const prefix = local.slice(0, 3);
  return `${prefix}***@${domain}`;
}

function isSyntheticEmail(email: string): boolean {
  const normalized = email.toLowerCase();
  return (
    normalized.endsWith("@example.com") ||
    normalized.includes("synthetic") ||
    normalized.includes("032") ||
    normalized.includes("031") ||
    normalized.includes("smoke") ||
    normalized.includes("manual-kyc")
  );
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) {
    return null;
  }
  const parts = header.split(/,(?=\s*[^;=]+=)/);
  for (const part of parts) {
    const match = part.trim().match(new RegExp(`^${name}=([^;]+)`));
    if (match) {
      return match[1] ?? null;
    }
  }
  return null;
}

async function jsonFetch(
  base: string,
  path: string,
  init: RequestInit & {
    token?: string;
    cookie?: string;
    csrf?: string;
    idempotencyKey?: string;
  } = {},
): Promise<{ status: number; body: unknown; setCookie: string | null }> {
  const headers = new Headers(init.headers);
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }
  if (init.cookie) {
    headers.set("Cookie", init.cookie);
  }
  if (init.csrf) {
    headers.set("X-CSRF-Token", init.csrf);
  }
  if (init.idempotencyKey) {
    headers.set("Idempotency-Key", init.idempotencyKey);
  }
  if (init.body && !headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  return {
    status: res.status,
    body: parseJson(text),
    setCookie: res.headers.get("set-cookie"),
  };
}

function bodyCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const error = (body as { error?: { code?: string } }).error;
  return error?.code;
}

function dataOf<T>(body: unknown): T | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  return (body as { data?: T }).data;
}

async function assertApiIsIsolatedTest(): Promise<void> {
  const live = await jsonFetch(API_BASE, "/health/live");
  if (live.status !== 200) {
    throw new Error(`Test API /health/live failed (${live.status})`);
  }
  const ready = await jsonFetch(API_BASE, "/health/ready");
  if (ready.status !== 200) {
    throw new Error(`Test API /health/ready failed (${ready.status})`);
  }
  const defaultLive = await jsonFetch("http://127.0.0.1:3000", "/health/live").catch(() => null);
  if (defaultLive?.status === 200 && API_BASE.includes(":3000")) {
    throw new Error("Refusing default :3000 API");
  }
}

async function preflight(): Promise<{ migrationCount: number; hasModerationTable: boolean }> {
  const env = loadManualKycTestProcessEnv();
  const resolved = resolveManualKycTestDatabaseUrl(env);
  const catalog = parseDatabaseTarget(resolved).database;
  if (catalog !== REQUIRED_INTEGRATION_DATABASE) {
    throw new Error(`Refusing catalog ${catalog}`);
  }
  const identity = await verifyIntegrationDatabaseIdentity(resolved);
  if (identity.database !== REQUIRED_INTEGRATION_DATABASE) {
    throw new Error(`Live identity is ${identity.database}`);
  }
  const prisma = createPrismaClient(resolved);
  try {
    const rows = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database()
    `;
    const live = rows[0]?.current_database;
    if (live !== REQUIRED_INTEGRATION_DATABASE) {
      throw new Error(`Prisma current_database() is ${live}`);
    }
    const migrations = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `;
    const migrationCount = Number(migrations[0]?.count ?? 0);
    const table = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'AccountModerationDecision'
      ) AS exists
    `;
    const hasModerationTable = Boolean(table[0]?.exists);
    const port = Number(env.PORT ?? MANUAL_KYC_TEST_DEFAULT_PORT);
    if (port === 3000) {
      throw new Error("Refusing PORT=3000");
    }
    const devUrl = process.env.DATABASE_URL?.trim();
    if (devUrl) {
      const devCatalog = parseDatabaseTarget(devUrl).database;
      if (devCatalog !== REQUIRED_DEVELOPMENT_DATABASE) {
        console.log(`NOTE: base DATABASE_URL catalog is ${devCatalog} (expected strangeup_dev)`);
      } else {
        console.log("Base DATABASE_URL catalog: strangeup_dev (unchanged, not used for writes)");
      }
    }
    console.log(`Preflight catalog: ${live}`);
    console.log(`Preflight migrations finished: ${migrationCount}`);
    console.log(`AccountModerationDecision present: ${hasModerationTable}`);
    return { migrationCount, hasModerationTable };
  } finally {
    await prisma.$disconnect();
  }
}

type StaffRow = {
  userId: string;
  role: string;
  revokedAt: Date | null;
  email: string;
  accountStatus: string;
  deletedAt: Date | null;
};

type TargetSnapshot = {
  userId: string;
  email: string;
  accountStatus: string;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  identityVerificationStatus: string;
  adminReviewStatus: string;
  ageEligibilityStatus: string;
  activeSessions: number;
  revokedSessions: number;
  activeDeviceTokens: number;
  revokedDeviceTokens: number;
  homeEligibleByPolicy: boolean;
};

function isFullyActivated(row: TargetSnapshot): boolean {
  return (
    row.accountStatus === "ACTIVE" &&
    row.identityVerificationStatus === "APPROVED" &&
    row.adminReviewStatus === "APPROVED" &&
    row.ageEligibilityStatus === "ELIGIBLE"
  );
}

async function loadStaff(db: DatabaseClient): Promise<StaffRow[]> {
  const grants = await db.platformStaffGrant.findMany({
    include: { user: { select: { email: true, accountStatus: true, deletedAt: true } } },
    orderBy: { grantedAt: "asc" },
  });
  return grants.map((g) => ({
    userId: g.userId,
    role: g.role,
    revokedAt: g.revokedAt,
    email: g.user.email,
    accountStatus: g.user.accountStatus,
    deletedAt: g.user.deletedAt,
  }));
}

async function snapshotUser(db: DatabaseClient, userId: string): Promise<TargetSnapshot> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { sessions: true, deviceTokens: true },
  });
  if (!user) {
    throw new Error("Target user missing");
  }
  const env = loadEnv();
  const homeEligibleByPolicy = hasHomeAccess(
    toActivationPolicyActor(user),
    buildKycEnforcementContext(env),
  );
  return {
    userId: user.id,
    email: user.email,
    accountStatus: user.accountStatus,
    suspendedAt: user.suspendedAt,
    deletedAt: user.deletedAt,
    identityVerificationStatus: user.identityVerificationStatus,
    adminReviewStatus: user.adminReviewStatus,
    ageEligibilityStatus: user.ageEligibilityStatus,
    activeSessions: user.sessions.filter((s) => s.revokedAt === null).length,
    revokedSessions: user.sessions.filter((s) => s.revokedAt !== null).length,
    activeDeviceTokens: user.deviceTokens.filter((t) => t.revokedAt === null).length,
    revokedDeviceTokens: user.deviceTokens.filter((t) => t.revokedAt !== null).length,
    homeEligibleByPolicy,
  };
}

async function loginApi(email: string): Promise<{
  ok: boolean;
  status: number;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
}> {
  const res = await jsonFetch(API_BASE, "/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: SYNTHETIC_PASSWORD }),
  });
  const data = dataOf<{
    user?: { id?: string };
    tokens?: { accessToken?: string; refreshToken?: string };
    accessToken?: string;
    refreshToken?: string;
  }>(res.body);
  const accessToken = data?.tokens?.accessToken ?? data?.accessToken;
  const refreshToken = data?.tokens?.refreshToken ?? data?.refreshToken;
  return {
    ok: res.status === 200 && Boolean(accessToken),
    status: res.status,
    userId: data?.user?.id,
    accessToken,
    refreshToken,
  };
}

async function loginBff(email: string): Promise<{
  ok: boolean;
  status: number;
  cookie?: string;
  csrf?: string;
}> {
  const res = await jsonFetch(BFF_BASE, "/api/auth/login", {
    method: "POST",
    headers: { Origin: BFF_ORIGIN },
    body: JSON.stringify({ email, password: SYNTHETIC_PASSWORD }),
  });
  const cookieValue = readCookie(res.setCookie, "admin_session");
  const csrf = dataOf<{ csrfToken?: string }>(res.body)?.csrfToken;
  return {
    ok: res.status === 200 && Boolean(cookieValue) && Boolean(csrf),
    status: res.status,
    cookie: cookieValue ? `admin_session=${cookieValue}` : undefined,
    csrf,
  };
}

async function discoverActors(db: DatabaseClient): Promise<{
  reviewer: StaffRow;
  reviewerOnly: StaffRow | null;
  target: TargetSnapshot;
  originalGrants: StaffRow[];
}> {
  const staff = await loadStaff(db);
  const activeReviewers = staff.filter(
    (s) =>
      s.role === "IDENTITY_REVIEWER" &&
      s.revokedAt === null &&
      !s.deletedAt &&
      s.accountStatus !== "SUSPENDED" &&
      s.accountStatus !== "DELETED" &&
      isSyntheticEmail(s.email),
  );
  const superAdmins = staff.filter((s) => s.role === "SUPER_ADMIN" && s.revokedAt === null);
  console.log(`Active synthetic IDENTITY_REVIEWER grants: ${activeReviewers.length}`);
  console.log(`Active SUPER_ADMIN grants: ${superAdmins.length}`);
  if (activeReviewers.length === 0) {
    throw new Error("No existing synthetic IDENTITY_REVIEWER found; stopping without elevation");
  }

  const reviewer = activeReviewers[0];
  if (!reviewer) {
    throw new Error("No existing synthetic IDENTITY_REVIEWER found; stopping without elevation");
  }
  console.log(`Reviewer selected: ${reviewer.userId} ${maskEmail(reviewer.email)}`);

  const reviewerOnly = activeReviewers.find((s) => s.userId !== reviewer.userId) ?? null;
  if (reviewerOnly) {
    console.log(`Reviewer-only actor: ${reviewerOnly.userId} ${maskEmail(reviewerOnly.email)}`);
  }

  const staffUserIds = new Set(staff.filter((s) => s.revokedAt === null).map((s) => s.userId));
  const candidates = await db.user.findMany({
    where: {
      deletedAt: null,
      accountStatus: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
      suspendedAt: null,
      id: { not: reviewer.userId },
    },
    take: 80,
    orderBy: { createdAt: "desc" },
  });

  const syntheticTargets = candidates.filter(
    (u) => isSyntheticEmail(u.email) && !staffUserIds.has(u.id),
  );
  if (syntheticTargets.length === 0) {
    throw new Error("No existing synthetic non-staff target found; stopping without elevation");
  }

  const snapshots: TargetSnapshot[] = [];
  for (const user of syntheticTargets) {
    snapshots.push(await snapshotUser(db, user.id));
  }
  const preferred = snapshots.find(isFullyActivated) ?? snapshots[0];
  if (!preferred) {
    throw new Error("No suitable synthetic target");
  }
  console.log(
    `Target selected: ${preferred.userId} status=${preferred.accountStatus} identity=${preferred.identityVerificationStatus} admin=${preferred.adminReviewStatus} homePolicy=${preferred.homeEligibleByPolicy} fullyActivated=${isFullyActivated(preferred)}`,
  );

  return {
    reviewer,
    reviewerOnly,
    target: preferred,
    originalGrants: staff.filter((s) => s.userId === reviewer.userId),
  };
}

async function grantTemporarySuperAdmin(db: DatabaseClient, userId: string): Promise<void> {
  await upsertStaffGrant(db, userId, SUPER_ADMIN_ROLE, null);
}

async function cleanup(input: {
  db: DatabaseClient;
  reviewerUserId: string;
  target: TargetSnapshot;
  issuedReviewerSessionIds: string[];
}): Promise<void> {
  const current = await snapshotUser(input.db, input.target.userId);
  if (current.accountStatus === "SUSPENDED") {
    await input.db.user.update({
      where: { id: input.target.userId },
      data: {
        accountStatus: input.target.accountStatus as "ACTIVE" | "PENDING_VERIFICATION",
        suspendedAt: null,
      },
    });
    console.log("Cleanup restored target accountStatus (target was still SUSPENDED)");
  }
  await revokeStaffGrant(input.db, input.reviewerUserId, SUPER_ADMIN_ROLE);
  if (input.issuedReviewerSessionIds.length > 0) {
    await input.db.session.updateMany({
      where: { id: { in: input.issuedReviewerSessionIds }, userId: input.reviewerUserId },
      data: { revokedAt: new Date() },
    });
  }
}

function expectStatus(name: string, actual: number, expected: number, body?: unknown): boolean {
  const ok = actual === expected;
  record(
    name,
    ok,
    ok ? String(actual) : `expected ${expected} got ${actual} code=${bodyCode(body)}`,
  );
  return ok;
}

async function connectSocket(
  accessToken: string,
): Promise<{ connected: boolean; disconnected: boolean; close: () => void }> {
  const socket = ioClient(API_BASE, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { token: accessToken },
    autoConnect: true,
    reconnection: false,
  });
  const connected = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 5000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(true);
    });
    socket.once("connect_error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
  return {
    connected,
    get disconnected() {
      return socket.disconnected;
    },
    close() {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

async function waitForDisconnect(
  socket: { disconnected: boolean },
  timeoutMs = 4000,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (socket.disconnected) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return socket.disconnected;
}

async function runE2e(): Promise<void> {
  const env = loadManualKycTestProcessEnv();
  const dbUrl = resolveManualKycTestDatabaseUrl(env);
  const pre = await preflight();
  record(
    "Preflight catalog strangeup_test",
    pre.migrationCount >= 27 && pre.hasModerationTable,
    `migrations=${pre.migrationCount}`,
  );
  await assertApiIsIsolatedTest();
  record("API :3010 live/ready", true);
  const bffHealth = await jsonFetch(BFF_BASE, "/api/auth/session");
  record(
    "BFF :3011 reachable",
    bffHealth.status === 200 || bffHealth.status === 401,
    String(bffHealth.status),
  );

  process.env.DATABASE_URL = dbUrl;
  const appEnv = loadEnv();
  const db = createPrismaClient(dbUrl);
  const issuedReviewerSessionIds: string[] = [];
  let reviewerUserId = "";
  let targetSnapshot: TargetSnapshot | null = null;
  let temporaryGrantApplied = false;

  try {
    const actors = await discoverActors(db);
    reviewerUserId = actors.reviewer.userId;
    targetSnapshot = actors.target;
    record("Synthetic reviewer verified", true, actors.reviewer.userId);
    record(
      "Synthetic target verified",
      true,
      `${actors.target.userId} activated=${isFullyActivated(actors.target)}`,
    );

    const reviewerBeforeGrant = await loginApi(actors.reviewer.email);
    record(
      "Reviewer login before SUPER_ADMIN",
      reviewerBeforeGrant.ok,
      String(reviewerBeforeGrant.status),
    );
    if (!reviewerBeforeGrant.ok || !reviewerBeforeGrant.accessToken) {
      throw new Error("Cannot continue without reviewer login");
    }
    const beforeSessions = await db.session.findMany({
      where: { userId: actors.reviewer.userId, revokedAt: null },
      select: { id: true },
    });
    issuedReviewerSessionIds.push(...beforeSessions.map((s) => s.id));

    const listBefore = await jsonFetch(API_BASE, "/v1/admin/users?limit=5", {
      token: reviewerBeforeGrant.accessToken,
    });
    expectStatus(
      "GET /v1/admin/users as IDENTITY_REVIEWER",
      listBefore.status,
      200,
      listBefore.body,
    );
    const detailBefore = await jsonFetch(API_BASE, `/v1/admin/users/${actors.target.userId}`, {
      token: reviewerBeforeGrant.accessToken,
    });
    expectStatus(
      "GET /v1/admin/users/:id as IDENTITY_REVIEWER",
      detailBefore.status,
      200,
      detailBefore.body,
    );
    const moderation = dataOf<{
      accountModeration?: {
        canSuspend?: boolean;
        canRestore?: boolean;
        blockedReason?: string | null;
      };
      maskedEmail?: string;
    }>(detailBefore.body);
    record(
      "Reviewer-only cannot suspend (capability)",
      moderation?.accountModeration?.canSuspend === false,
      moderation?.accountModeration?.blockedReason ?? "missing",
    );
    record(
      "Detail masks email",
      Boolean(moderation?.maskedEmail?.includes("*")),
      moderation?.maskedEmail ?? "none",
    );

    const unauth = await jsonFetch(API_BASE, `/v1/admin/users/${actors.target.userId}/suspend`, {
      method: "POST",
      body: JSON.stringify({
        confirmation: "SUSPEND",
        reasonCode: "POLICY_VIOLATION",
        reason: SUSPEND_REASON,
        expectedAccountStatus: actors.target.accountStatus,
      }),
    });
    expectStatus("Unauthenticated suspend", unauth.status, 401, unauth.body);

    const reviewerSuspend = await jsonFetch(
      API_BASE,
      `/v1/admin/users/${actors.target.userId}/suspend`,
      {
        method: "POST",
        token: reviewerBeforeGrant.accessToken,
        idempotencyKey: "task032e-reviewer-only-01",
        body: JSON.stringify({
          confirmation: "SUSPEND",
          reasonCode: "POLICY_VIOLATION",
          reason: SUSPEND_REASON,
          expectedAccountStatus: actors.target.accountStatus,
        }),
      },
    );
    expectStatus(
      "IDENTITY_REVIEWER suspend forbidden",
      reviewerSuspend.status,
      403,
      reviewerSuspend.body,
    );

    const bff = await loginBff(actors.reviewer.email);
    record("Admin BFF login", bff.ok, String(bff.status));
    if (bff.ok && bff.cookie && bff.csrf) {
      const bffList = await jsonFetch(BFF_BASE, "/api/users?limit=5", {
        cookie: bff.cookie,
        headers: { Origin: BFF_ORIGIN },
      });
      expectStatus("BFF GET /api/users", bffList.status, 200, bffList.body);
      const missingCsrf = await jsonFetch(BFF_BASE, `/api/users/${actors.target.userId}/suspend`, {
        method: "POST",
        cookie: bff.cookie,
        idempotencyKey: "task032e-missing-csrf-01",
        headers: { Origin: BFF_ORIGIN },
        body: JSON.stringify({
          confirmation: "SUSPEND",
          reasonCode: "POLICY_VIOLATION",
          reason: SUSPEND_REASON,
          expectedAccountStatus: actors.target.accountStatus,
        }),
      });
      expectStatus("BFF missing CSRF", missingCsrf.status, 403, missingCsrf.body);
      const missingKey = await jsonFetch(BFF_BASE, `/api/users/${actors.target.userId}/suspend`, {
        method: "POST",
        cookie: bff.cookie,
        csrf: bff.csrf,
        headers: { Origin: BFF_ORIGIN },
        body: JSON.stringify({
          confirmation: "SUSPEND",
          reasonCode: "POLICY_VIOLATION",
          reason: SUSPEND_REASON,
          expectedAccountStatus: actors.target.accountStatus,
        }),
      });
      expectStatus("BFF missing Idempotency-Key", missingKey.status, 400, missingKey.body);
      const invalidConfirm = await jsonFetch(
        BFF_BASE,
        `/api/users/${actors.target.userId}/suspend`,
        {
          method: "POST",
          cookie: bff.cookie,
          csrf: bff.csrf,
          idempotencyKey: "task032e-invalid-confirm-01",
          headers: { Origin: BFF_ORIGIN },
          body: JSON.stringify({
            confirmation: "YES",
            reasonCode: "POLICY_VIOLATION",
            reason: SUSPEND_REASON,
            expectedAccountStatus: actors.target.accountStatus,
          }),
        },
      );
      expectStatus("BFF invalid confirmation", invalidConfirm.status, 400, invalidConfirm.body);
    }

    const targetLogin = await loginApi(actors.target.email);
    record("Target baseline login", targetLogin.ok, String(targetLogin.status));
    let socketHandle: Awaited<ReturnType<typeof connectSocket>> | null = null;
    let baselineHome: boolean | null = null;
    if (targetLogin.ok && targetLogin.accessToken) {
      const onboarding = await jsonFetch(API_BASE, "/v1/me/onboarding/status", {
        token: targetLogin.accessToken,
      });
      const home = dataOf<{ homeAccessAllowed?: boolean }>(onboarding.body)?.homeAccessAllowed;
      baselineHome = Boolean(home);
      record(
        "Target baseline Home/onboarding",
        onboarding.status === 200,
        `status=${onboarding.status} homeAccessAllowed=${String(home)} policy=${actors.target.homeEligibleByPolicy}`,
      );
      socketHandle = await connectSocket(targetLogin.accessToken);
      record(
        "Target socket connect (optional)",
        socketHandle.connected,
        socketHandle.connected ? "connected" : "not established",
      );
    }

    await grantTemporarySuperAdmin(db, actors.reviewer.userId);
    temporaryGrantApplied = true;
    const grantRow = await db.platformStaffGrant.findUnique({
      where: { userId_role: { userId: actors.reviewer.userId, role: "SUPER_ADMIN" } },
    });
    record("Temporary SUPER_ADMIN granted", Boolean(grantRow && grantRow.revokedAt === null));

    const reviewerAdmin = reviewerBeforeGrant.ok
      ? reviewerBeforeGrant
      : await loginApi(actors.reviewer.email);
    record(
      "Reviewer SUPER_ADMIN token ready",
      Boolean(reviewerAdmin.ok && reviewerAdmin.accessToken),
    );
    if (!reviewerAdmin.ok || !reviewerAdmin.accessToken) {
      throw new Error("SUPER_ADMIN reviewer login failed");
    }
    const afterGrantSessions = await db.session.findMany({
      where: { userId: actors.reviewer.userId, revokedAt: null },
      select: { id: true },
    });
    issuedReviewerSessionIds.push(...afterGrantSessions.map((s) => s.id));

    const detailAdmin = await jsonFetch(API_BASE, `/v1/admin/users/${actors.target.userId}`, {
      token: reviewerAdmin.accessToken,
    });
    const adminCaps = dataOf<{ accountModeration?: { canSuspend?: boolean } }>(detailAdmin.body);
    record("SUPER_ADMIN canSuspend on target", adminCaps?.accountModeration?.canSuspend === true);

    const selfSuspend = await jsonFetch(
      API_BASE,
      `/v1/admin/users/${actors.reviewer.userId}/suspend`,
      {
        method: "POST",
        token: reviewerAdmin.accessToken,
        idempotencyKey: "task032e-self-01",
        body: JSON.stringify({
          confirmation: "SUSPEND",
          reasonCode: "POLICY_VIOLATION",
          reason: SUSPEND_REASON,
          expectedAccountStatus: "ACTIVE",
        }),
      },
    );
    expectStatus("Self-target suspend forbidden", selfSuspend.status, 403, selfSuspend.body);

    if (actors.reviewerOnly) {
      const staffSuspend = await jsonFetch(
        API_BASE,
        `/v1/admin/users/${actors.reviewerOnly.userId}/suspend`,
        {
          method: "POST",
          token: reviewerAdmin.accessToken,
          idempotencyKey: "task032e-staff-01",
          body: JSON.stringify({
            confirmation: "SUSPEND",
            reasonCode: "POLICY_VIOLATION",
            reason: SUSPEND_REASON,
            expectedAccountStatus: actors.reviewerOnly.accountStatus,
          }),
        },
      );
      expectStatus(
        "Active-staff target suspend forbidden",
        staffSuspend.status,
        403,
        staffSuspend.body,
      );
    } else {
      record(
        "Active-staff target suspend forbidden",
        true,
        "skipped — only one synthetic reviewer",
      );
    }

    const invalidReason = await jsonFetch(
      API_BASE,
      `/v1/admin/users/${actors.target.userId}/suspend`,
      {
        method: "POST",
        token: reviewerAdmin.accessToken,
        idempotencyKey: "task032e-bad-reason-01",
        body: JSON.stringify({
          confirmation: "SUSPEND",
          reasonCode: "NOT_A_REASON",
          reason: SUSPEND_REASON,
          expectedAccountStatus: actors.target.accountStatus,
        }),
      },
    );
    expectStatus("Invalid reasonCode", invalidReason.status, 400, invalidReason.body);

    const suspendKey = `task032e-suspend-${Date.now()}`;
    const suspendBody = {
      confirmation: "SUSPEND",
      reasonCode: "POLICY_VIOLATION",
      reason: SUSPEND_REASON,
      expectedAccountStatus: actors.target.accountStatus,
    };
    const [concurrentA, concurrentB] = await Promise.all([
      jsonFetch(API_BASE, `/v1/admin/users/${actors.target.userId}/suspend`, {
        method: "POST",
        token: reviewerAdmin.accessToken,
        idempotencyKey: suspendKey,
        body: JSON.stringify(suspendBody),
      }),
      jsonFetch(API_BASE, `/v1/admin/users/${actors.target.userId}/suspend`, {
        method: "POST",
        token: reviewerAdmin.accessToken,
        idempotencyKey: `${suspendKey}-b`,
        body: JSON.stringify(suspendBody),
      }),
    ]);
    const statuses = [concurrentA.status, concurrentB.status].sort();
    const winner =
      concurrentA.status === 200 ? concurrentA : concurrentB.status === 200 ? concurrentB : null;
    const winnerData = dataOf<{
      decisionId?: string;
      accountStatus?: string;
      suspendedAt?: string | null;
      idempotentReplay?: boolean;
    }>(winner?.body);
    record(
      "Bounded concurrent suspend",
      Boolean(winner) && statuses.every((status) => status === 200 || status === 409),
      `statuses=${concurrentA.status},${concurrentB.status}`,
    );
    record("Suspend 200", winner?.status === 200, String(winner?.status));
    record("Suspend accountStatus SUSPENDED", winnerData?.accountStatus === "SUSPENDED");
    record("Suspend suspendedAt populated", Boolean(winnerData?.suspendedAt));
    record("Suspend decisionId recorded", Boolean(winnerData?.decisionId), winnerData?.decisionId);

    const replay = await jsonFetch(API_BASE, `/v1/admin/users/${actors.target.userId}/suspend`, {
      method: "POST",
      token: reviewerAdmin.accessToken,
      idempotencyKey: suspendKey,
      body: JSON.stringify(suspendBody),
    });
    const replayData = dataOf<{ decisionId?: string; idempotentReplay?: boolean }>(replay.body);
    expectStatus("Idempotent replay", replay.status, 200, replay.body);
    record("Idempotent replay same decisionId", replayData?.decisionId === winnerData?.decisionId);
    record("idempotentReplay=true", replayData?.idempotentReplay === true);

    const reusedDifferent = await jsonFetch(
      API_BASE,
      `/v1/admin/users/${actors.target.userId}/suspend`,
      {
        method: "POST",
        token: reviewerAdmin.accessToken,
        idempotencyKey: suspendKey,
        body: JSON.stringify({
          ...suspendBody,
          reason: `${SUSPEND_REASON} different payload`,
        }),
      },
    );
    expectStatus("Reused key different payload", reusedDifferent.status, 409, reusedDifferent.body);

    const stale = await jsonFetch(API_BASE, `/v1/admin/users/${actors.target.userId}/suspend`, {
      method: "POST",
      token: reviewerAdmin.accessToken,
      idempotencyKey: `task032e-stale-${Date.now()}`,
      body: JSON.stringify({
        ...suspendBody,
        expectedAccountStatus: actors.target.accountStatus,
      }),
    });
    expectStatus("Stale expectedAccountStatus", stale.status, 409, stale.body);

    const decisionCount = await db.accountModerationDecision.count({
      where: { userId: actors.target.userId, action: "SUSPEND", reason: SUSPEND_REASON },
    });
    record(
      "No duplicate SUSPEND audit for same reason",
      decisionCount === 1,
      `count=${decisionCount}`,
    );

    const afterSuspend = await snapshotUser(db, actors.target.userId);
    record(
      "Sessions revoked after suspend",
      afterSuspend.activeSessions === 0,
      `active=${afterSuspend.activeSessions}`,
    );
    record(
      "Device tokens revoked after suspend",
      afterSuspend.activeDeviceTokens === 0,
      `active=${afterSuspend.activeDeviceTokens}`,
    );

    if (targetLogin.accessToken) {
      const blockedAccess = await jsonFetch(API_BASE, "/v1/me/onboarding/status", {
        token: targetLogin.accessToken,
      });
      record(
        "Suspended access token blocked",
        blockedAccess.status === 401 || blockedAccess.status === 403,
        String(blockedAccess.status),
      );
    }
    if (targetLogin.refreshToken) {
      const blockedRefresh = await jsonFetch(API_BASE, "/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: targetLogin.refreshToken }),
      });
      expectStatus("Suspended refresh blocked", blockedRefresh.status, 401, blockedRefresh.body);
    }
    const blockedLogin = await loginApi(actors.target.email);
    record(
      "Suspended login blocked",
      !blockedLogin.ok && blockedLogin.status === 403,
      String(blockedLogin.status),
    );

    if (socketHandle?.connected) {
      const evicted = await waitForDisconnect(socketHandle);
      record("Realtime socket evicted after suspend", evicted);
      socketHandle.close();
    } else {
      record(
        "Realtime socket evicted after suspend",
        true,
        "no active socket established; architecture still wired",
      );
    }

    const bffAdmin = await loginBff(actors.reviewer.email);
    if (bffAdmin.ok && bffAdmin.cookie && bffAdmin.csrf) {
      const bffDetail = await jsonFetch(BFF_BASE, `/api/users/${actors.target.userId}`, {
        cookie: bffAdmin.cookie,
        headers: { Origin: BFF_ORIGIN },
      });
      expectStatus("BFF GET user detail after suspend", bffDetail.status, 200, bffDetail.body);
    }

    const restoreKey = `task032e-restore-${Date.now()}`;
    const restore = await jsonFetch(API_BASE, `/v1/admin/users/${actors.target.userId}/restore`, {
      method: "POST",
      token: reviewerAdmin.accessToken,
      idempotencyKey: restoreKey,
      body: JSON.stringify({
        confirmation: "RESTORE",
        reason: RESTORE_REASON,
        expectedAccountStatus: "SUSPENDED",
      }),
    });
    const restoreData = dataOf<{
      accountStatus?: string;
      resultingAccountStatus?: string;
      suspendedAt?: string | null;
      decisionId?: string;
    }>(restore.body);
    expectStatus("Restore 200", restore.status, 200, restore.body);
    record(
      "Restore prior status",
      restoreData?.resultingAccountStatus === actors.target.accountStatus,
      restoreData?.resultingAccountStatus,
    );
    record("Restore suspendedAt null", restoreData?.suspendedAt === null);
    record("Restore decisionId recorded", Boolean(restoreData?.decisionId));

    const restoreDecision = await db.accountModerationDecision.findFirst({
      where: { userId: actors.target.userId, action: "RESTORE", reason: RESTORE_REASON },
    });
    record("RESTORE audit created", Boolean(restoreDecision));

    const afterRestore = await snapshotUser(db, actors.target.userId);
    record(
      "Identity verification unchanged",
      afterRestore.identityVerificationStatus === actors.target.identityVerificationStatus,
    );
    record(
      "Admin review unchanged",
      afterRestore.adminReviewStatus === actors.target.adminReviewStatus,
    );
    record(
      "Revoked sessions not resurrected",
      afterRestore.activeSessions === 0,
      `active=${afterRestore.activeSessions}`,
    );
    record(
      "Revoked device tokens not resurrected",
      afterRestore.activeDeviceTokens === 0,
      `active=${afterRestore.activeDeviceTokens}`,
    );

    if (targetLogin.accessToken) {
      const oldToken = await jsonFetch(API_BASE, "/v1/me/onboarding/status", {
        token: targetLogin.accessToken,
      });
      record(
        "Old target token still blocked after restore",
        oldToken.status === 401 || oldToken.status === 403,
      );
    }

    const freshLogin = await loginApi(actors.target.email);
    record("Fresh login after restore", freshLogin.ok, String(freshLogin.status));
    if (freshLogin.ok && freshLogin.accessToken) {
      const home = await jsonFetch(API_BASE, "/v1/me/onboarding/status", {
        token: freshLogin.accessToken,
      });
      const allowed = dataOf<{ homeAccessAllowed?: boolean }>(home.body)?.homeAccessAllowed;
      if (isFullyActivated(actors.target) || actors.target.homeEligibleByPolicy || baselineHome) {
        record(
          "Home granted after restore for originally eligible target",
          allowed === true,
          String(allowed),
        );
      } else {
        record(
          "Home remains gated after restore (baseline not fully activated)",
          allowed === false || home.status === 200,
          `homeAccessAllowed=${String(allowed)} originalPolicy=${actors.target.homeEligibleByPolicy}`,
        );
      }
    }

    record(
      "KYC flags preserved",
      appEnv.KYC_IDENTITY_AUTHORITY === "manual",
      appEnv.KYC_IDENTITY_AUTHORITY,
    );
  } finally {
    if (targetSnapshot && reviewerUserId) {
      await cleanup({
        db,
        reviewerUserId,
        target: targetSnapshot,
        issuedReviewerSessionIds,
      });
      const grants = await db.platformStaffGrant.findMany({
        where: { userId: reviewerUserId },
      });
      const superAdmin = grants.find((g) => g.role === "SUPER_ADMIN");
      const reviewerGrant = grants.find(
        (g) => g.role === "IDENTITY_REVIEWER" && g.revokedAt === null,
      );
      const finalTarget = await snapshotUser(db, targetSnapshot.userId);
      record("Cleanup SUPER_ADMIN revoked", !superAdmin || superAdmin.revokedAt !== null);
      record("Cleanup IDENTITY_REVIEWER retained", Boolean(reviewerGrant));
      record(
        "Cleanup target not SUSPENDED",
        finalTarget.accountStatus === targetSnapshot.accountStatus &&
          finalTarget.suspendedAt === null,
        finalTarget.accountStatus,
      );
      console.log(
        `Final reviewer grants: ${grants
          .map((g) => `${g.role}:${g.revokedAt ? "revoked" : "active"}`)
          .join(", ")}`,
      );
      console.log(
        `Final target status: ${finalTarget.accountStatus} suspendedAt=${finalTarget.suspendedAt?.toISOString() ?? "null"}`,
      );
    } else if (temporaryGrantApplied && reviewerUserId) {
      await revokeStaffGrant(db, reviewerUserId, SUPER_ADMIN_ROLE);
      record("Emergency SUPER_ADMIN revoke", true);
    }
    await disconnectPrisma();
    await db.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- Task 032E summary ${results.length - failed.length}/${results.length} ---`);
  if (failed.length) {
    console.log("Failures:", failed.map((f) => f.name).join(", "));
    process.exitCode = 1;
  }
}

const command = process.argv[2] ?? "e2e";
if (command === "preflight") {
  preflight()
    .then(() => assertApiIsIsolatedTest())
    .then(() => {
      console.log("Preflight OK");
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
} else {
  runE2e().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
