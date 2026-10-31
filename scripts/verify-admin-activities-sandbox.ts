/**
 * Task 033C — authorized API verification against seeded strangeup_test rows.
 * Uses existing IDENTITY_REVIEWER sandbox access. Never logs tokens or secrets.
 */
import {
  ACTIVITY_SPECS,
  PRIVATE_MEETING_CANARY,
  PRIVATE_VIRTUAL_CANARY,
  SEED_MARKER,
  connectSandbox,
  seedActivityId,
} from "./seed-admin-activities-sandbox.js";

const API_BASE = "http://127.0.0.1:3010";
const REVIEWER_ID = "2d2c65f8-a06f-4150-805e-dd97fdac9e55";
const SYNTHETIC_PASSWORD = "ValidPass1";
const LEAK_CANARIES = [PRIVATE_MEETING_CANARY, PRIVATE_VIRTUAL_CANARY];
const FORBIDDEN_KEYS = new Set([
  "coverStorageKey",
  "meetingInstructions",
  "virtualMeetingDetails",
  "latitude",
  "longitude",
  "coordinates",
  "storageKey",
]);

type Step = { name: string; ok: boolean; detail?: string };
const results: Step[] = [];

function record(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` — ${detail}` : ""}`);
}

function debugValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return "***";
  }
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

function containsLeak(payload: unknown): string | null {
  const text = JSON.stringify(payload);
  for (const canary of LEAK_CANARIES) {
    if (text.includes(canary)) {
      return canary;
    }
  }
  for (const key of collectKeys(payload)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return `key:${key}`;
    }
  }
  const emailMatches = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  for (const email of emailMatches) {
    if (!/^[a-z]\*\*\*@/i.test(email)) {
      return `unmasked_email:${email}`;
    }
  }
  return null;
}

async function jsonFetch(
  path: string,
  token?: string,
): Promise<{ status: number; body: unknown; text: string; headers: Headers }> {
  const headers = new Headers({ Accept: "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${API_BASE}${path}`, { headers });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, text, headers: res.headers };
}

async function loginReviewer(
  db: Awaited<ReturnType<typeof connectSandbox>>["db"],
): Promise<string> {
  const reviewer = await db.user.findUnique({
    where: { id: REVIEWER_ID },
    select: {
      id: true,
      email: true,
      emailNormalized: true,
      accountStatus: true,
      platformStaffGrants: { select: { role: true, revokedAt: true } },
    },
  });
  if (!reviewer) {
    throw new Error("Sandbox reviewer not found");
  }
  if (!reviewer.emailNormalized.endsWith("@example.com")) {
    throw new Error("Refusing non-synthetic reviewer email");
  }
  const active = reviewer.platformStaffGrants.some(
    (grant) =>
      grant.revokedAt === null &&
      (grant.role === "IDENTITY_REVIEWER" || grant.role === "SUPER_ADMIN"),
  );
  if (!active) {
    throw new Error("Reviewer has no active staff grant");
  }
  console.log("reviewer", maskEmail(reviewer.email), reviewer.accountStatus);
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: reviewer.email, password: SYNTHETIC_PASSWORD }),
  });
  const body = (await res.json()) as { data?: { accessToken?: string } };
  if (res.status !== 200 || !body.data?.accessToken) {
    throw new Error(`Reviewer login failed (${res.status})`);
  }
  return body.data.accessToken;
}

async function main(): Promise<void> {
  const { db, databaseUrl } = await connectSandbox();
  try {
    const live = await db.$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database() AS database`;
    record("database identity", live[0]?.database === "strangeup_test", live[0]?.database);

    const health = await jsonFetch("/health/ready");
    record("api ready", health.status === 200, String(health.status));

    const denied = await jsonFetch("/v1/admin/activities/summary");
    record("unauthenticated summary denied", denied.status === 401, String(denied.status));

    const token = await loginReviewer(db);
    record("authorized reviewer login", true, "IDENTITY_REVIEWER");

    const summaryRes = await jsonFetch("/v1/admin/activities/summary", token);
    const summary = asRecord(asRecord(summaryRes.body)?.data);
    record("summary status", summaryRes.status === 200, String(summaryRes.status));
    record(
      "six metric sources",
      Boolean(
        summary &&
        typeof summary.totalActivities === "number" &&
        summary.scheduleWindows &&
        asRecord(summary.unsupportedLifecycleCards)?.pendingApproval &&
        asRecord(summary.unsupportedLifecycleCards)?.suspended,
      ),
      `total=${String(summary?.totalActivities)} activeNow=${String(asRecord(summary?.scheduleWindows)?.activeNow)} upcoming=${String(asRecord(summary?.scheduleWindows)?.upcomingNext14Days)} completed=${String(summary?.completed)}`,
    );
    record(
      "no invented lifecycle cards",
      Boolean(
        asRecord(asRecord(summary?.unsupportedLifecycleCards)?.pendingApproval)?.available ===
          false &&
        asRecord(asRecord(summary?.unsupportedLifecycleCards)?.suspended)?.available === false,
      ),
    );
    record(
      "summary privacy",
      !containsLeak(summaryRes.body),
      containsLeak(summaryRes.body) ?? "clean",
    );

    const listRes = await jsonFetch("/v1/admin/activities?limit=20&q=033C", token);
    const list = asRecord(asRecord(listRes.body)?.data);
    const activities = Array.isArray(list?.activities) ? list.activities : [];
    record(
      "search 033C",
      listRes.status === 200 && activities.length > 0,
      `rows=${activities.length} total=${String(list?.totalMatching)}`,
    );
    record(
      "cursor pagination present",
      typeof list?.nextCursor === "string" || list?.nextCursor === null,
    );
    record("list privacy", !containsLeak(listRes.body), containsLeak(listRes.body) ?? "clean");

    const filtered = await jsonFetch(
      "/v1/admin/activities?limit=20&status=PUBLISHED&category=biking&location=Miami&when=upcoming",
      token,
    );
    const filteredData = asRecord(asRecord(filtered.body)?.data);
    const filteredRows = Array.isArray(filteredData?.activities) ? filteredData.activities : [];
    const filterOk =
      filtered.status === 200 &&
      filteredRows.every((row) => {
        const item = asRecord(row);
        return item?.status === "PUBLISHED" && item?.categorySlug === "biking";
      });
    record(
      "server filters",
      filterOk,
      `rows=${filteredRows.length} total=${String(filteredData?.totalMatching)}`,
    );

    const page1 = await jsonFetch("/v1/admin/activities?limit=10&q=033C", token);
    const page1Data = asRecord(asRecord(page1.body)?.data);
    const cursor = typeof page1Data?.nextCursor === "string" ? page1Data.nextCursor : null;
    if (cursor) {
      const page2 = await jsonFetch(
        `/v1/admin/activities?limit=10&q=033C&cursor=${encodeURIComponent(cursor)}`,
        token,
      );
      const page2Data = asRecord(asRecord(page2.body)?.data);
      const ids1 = new Set(
        (Array.isArray(page1Data?.activities) ? page1Data.activities : []).map(
          (row) => asRecord(row)?.activityId,
        ),
      );
      const overlap = (Array.isArray(page2Data?.activities) ? page2Data.activities : []).some(
        (row) => ids1.has(asRecord(row)?.activityId),
      );
      record("cursor page 2", page2.status === 200 && !overlap, `overlap=${overlap}`);
    } else {
      record("cursor page 2", false, "missing nextCursor for 033C search");
    }

    const exportRes = await fetch(`${API_BASE}/v1/admin/activities/export?q=033C`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" },
    });
    const csv = await exportRes.text();
    record(
      "csv export",
      exportRes.status === 200 && csv.includes("activity_id"),
      `bytes=${csv.length}`,
    );
    record(
      "csv privacy",
      !csv.includes(PRIVATE_MEETING_CANARY) &&
        !csv.includes(PRIVATE_VIRTUAL_CANARY) &&
        !csv.includes("meetingInstructions") &&
        !csv.includes("coverStorageKey"),
    );
    record("csv masked host email", csv.includes("host_masked_email") && csv.includes("***@"));

    const detailId = seedActivityId(1);
    const detailRes = await jsonFetch(`/v1/admin/activities/${detailId}`, token);
    const detail = asRecord(asRecord(detailRes.body)?.data);
    record("detail status", detailRes.status === 200, String(detailRes.status));
    record("detail title", detail?.title === ACTIVITY_SPECS[0]?.title, debugValue(detail?.title));
    record(
      "detail participation counts",
      typeof detail?.confirmedCount === "number" && typeof detail?.capacity === "number",
      `${String(detail?.confirmedCount)}/${String(detail?.capacity)}`,
    );
    record(
      "detail host/location/description",
      Boolean(
        detail?.host &&
        (detail.locationSummary || detail.mode === "VIRTUAL") &&
        debugValue(detail.description).includes(SEED_MARKER),
      ),
    );
    record(
      "detail privacy",
      !containsLeak(detailRes.body),
      containsLeak(detailRes.body) ?? "clean",
    );
    record(
      "moderation unavailable",
      asRecord(detail?.capabilities)?.canEdit === false &&
        asRecord(detail?.capabilities)?.canSuspend === false &&
        asRecord(detail?.capabilities)?.canCancel === false &&
        asRecord(detail?.capabilities)?.canDelete === false,
    );

    const emptyId = seedActivityId(10);
    const emptyRes = await jsonFetch(`/v1/admin/activities/${emptyId}`, token);
    const empty = asRecord(asRecord(emptyRes.body)?.data);
    record("zero-participant detail", emptyRes.status === 200 && empty?.confirmedCount === 0);

    const fullId = seedActivityId(7);
    const fullRes = await jsonFetch(`/v1/admin/activities/${fullId}`, token);
    const full = asRecord(asRecord(fullRes.body)?.data);
    record(
      "fully booked detail",
      fullRes.status === 200 && Number(full?.confirmedCount) === Number(full?.capacity),
      `${String(full?.confirmedCount)}/${String(full?.capacity)}`,
    );

    const activeId = seedActivityId(13);
    const activeRes = await jsonFetch(`/v1/admin/activities/${activeId}`, token);
    const active = asRecord(asRecord(activeRes.body)?.data);
    record(
      "in-session detail",
      activeRes.status === 200 && active?.schedulePhase === "IN_SESSION",
      debugValue(active?.schedulePhase),
    );

    const seedCount = await db.activity.count({
      where: { description: { contains: SEED_MARKER } },
    });
    record("seed rows persist", seedCount === ACTIVITY_SPECS.length, String(seedCount));
    void databaseUrl;
  } finally {
    await db.$disconnect();
  }

  const failed = results.filter((row) => !row.ok);
  console.log(`RESULT ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
