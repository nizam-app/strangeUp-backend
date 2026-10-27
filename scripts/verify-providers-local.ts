/**
 * Local provider verification (Task 019B). Prints redacted diagnostics only.
 * Does NOT send email unless RESEND_SMOKE_AUTHORIZED=1 and RESEND_SMOKE_TO are set.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { loadEnv } from "../src/config/env.js";
import { createRedisRateLimitStore } from "../src/infrastructure/rate-limit/redis-store.js";
import { createUnavailableRateLimitStore } from "../src/infrastructure/rate-limit/unavailable-store.js";
import { throwIfRateLimited } from "../src/modules/auth/rate-limit.js";

function fingerprint(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

function maskSecret(value: string | undefined): string {
  if (!value?.trim()) {
    return "[unset]";
  }
  const v = value.trim().replace(/^["']|["']$/g, "");
  if (v.length <= 8) {
    return "[set:len<9]";
  }
  return `[set:sha256:${fingerprint(v)}]`;
}

function maskEmail(value: string | undefined): string {
  if (!value?.trim()) {
    return "[unset]";
  }
  const [local, domain] = value.trim().split("@");
  if (!domain) {
    return "[invalid]";
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskRedisUrl(value: string | undefined): string {
  if (!value?.trim()) {
    return "[unset]";
  }
  try {
    const normalized = value.trim().replace(/^["']|["']$/g, "");
    const url = new URL(normalized);
    return `${url.protocol}//${url.hostname}:${url.port || "6379"}`;
  } catch {
    return "[invalid-url]";
  }
}

type ResendDomainRow = { name: string; status: string; region?: string };

async function fetchResendDomains(apiKey: string): Promise<{
  ok: boolean;
  status: number;
  domains: ResendDomainRow[];
  error?: string;
}> {
  const response = await fetch("https://api.resend.com/domains", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    data?: ResendDomainRow[];
    message?: string;
  };
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      domains: [],
      error: body.message ?? `HTTP ${response.status}`,
    };
  }
  return { ok: true, status: response.status, domains: body.data ?? [] };
}

async function main(): Promise<void> {
  const raw = process.env;
  const report: Record<string, unknown> = {
    task: "019B-provider-verification",
    timestampUtc: new Date().toISOString(),
    ciSafeDefaults: {
      transactionalEmailMode: raw.TRANSACTIONAL_EMAIL_MODE ?? "dev_stub",
      rateLimitStore: raw.RATE_LIMIT_STORE ?? "memory",
    },
    envPresence: {
      RESEND_API_KEY: maskSecret(raw.RESEND_API_KEY),
      TRANSACTIONAL_EMAIL_FROM: maskEmail(raw.TRANSACTIONAL_EMAIL_FROM),
      PUBLIC_APP_BASE_URL: raw.PUBLIC_APP_BASE_URL?.trim() || "[unset]",
      RATE_LIMIT_REDIS_URL: maskRedisUrl(raw.RATE_LIMIT_REDIS_URL),
      RESEND_SMOKE_TEST: raw.RESEND_SMOKE_TEST ?? "[unset]",
      RESEND_SMOKE_TO: raw.RESEND_SMOKE_TO ? maskEmail(raw.RESEND_SMOKE_TO) : "[unset]",
      RESEND_SMOKE_AUTHORIZED: raw.RESEND_SMOKE_AUTHORIZED ?? "[unset]",
    },
  };

  let envParseOk = true;
  let envParseError: string | undefined;
  try {
    loadEnv(raw);
  } catch (err) {
    envParseOk = false;
    envParseError = err instanceof Error ? err.message : "unknown";
  }
  report.envSchemaValid = envParseOk;
  if (envParseError) {
    report.envSchemaError = envParseError;
  }

  const apiKey = raw.RESEND_API_KEY?.trim().replace(/^["']|["']$/g, "");
  const fromAddress = raw.TRANSACTIONAL_EMAIL_FROM?.trim();
  const fromDomain = fromAddress?.includes("@") ? fromAddress.split("@")[1] : undefined;

  report.fromDomain = fromDomain ?? "[unset]";
  report.fromDomainLooksPlaceholder =
    fromDomain !== undefined &&
    (fromDomain.includes("your-verified-domain") || fromDomain.includes("example.com"));

  if (apiKey) {
    report.resendKeyFingerprint = fingerprint(apiKey);
    try {
      const domains = await fetchResendDomains(apiKey);
      report.resendApi = {
        reachable: domains.ok,
        httpStatus: domains.status,
        error: domains.error ?? null,
        domainCount: domains.domains.length,
        domains: domains.domains.map((d) => ({
          name: d.name,
          status: d.status,
          region: d.region ?? null,
        })),
        fromDomainVerified:
          fromDomain !== undefined
            ? domains.domains.some((d) => d.name === fromDomain && d.status === "verified")
            : false,
      };
    } catch (err) {
      report.resendApi = {
        reachable: false,
        error: err instanceof Error ? err.message : "network error",
      };
    }
  } else {
    report.resendApi = { skipped: true, reason: "RESEND_API_KEY unset" };
  }

  report.publicAppBaseUrl = {
    configured: Boolean(raw.PUBLIC_APP_BASE_URL?.trim()),
    value: raw.PUBLIC_APP_BASE_URL?.trim() || null,
    providerReady: Boolean(raw.PUBLIC_APP_BASE_URL?.trim()) && !report.fromDomainLooksPlaceholder,
  };

  const redisUrl = raw.RATE_LIMIT_REDIS_URL?.trim().replace(/^["']|["']$/g, "");
  if (redisUrl) {
    report.redisUrlFingerprint = fingerprint(redisUrl);
    try {
      const store = await createRedisRateLimitStore({
        redisUrl,
        commandTimeoutMs: Number(raw.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS ?? 2_000),
        keyPrefix: "strangeup:verify:",
      });

      const testKey = `verify:${Date.now()}`;
      const limit = 2;
      const windowMs = 60_000;
      const r1 = await store.check(testKey, limit, windowMs);
      const r2 = await store.check(testKey, limit, windowMs);
      const r3 = await store.check(testKey, limit, windowMs);

      report.redisLive = {
        pingReady: true,
        protocol: redisUrl.startsWith("rediss://") ? "rediss" : "redis",
        host: maskRedisUrl(redisUrl),
        atomicWindowCheck: {
          first: r1.allowed,
          second: r2.allowed,
          thirdBlocked: !r3.allowed,
          thirdReason: !r3.allowed && "reason" in r3 ? r3.reason : null,
        },
      };

      await store.disconnect();
    } catch (err) {
      report.redisLive = {
        pingReady: false,
        error: err instanceof Error ? err.message : "connection failed",
      };
    }
  } else {
    report.redisLive = { skipped: true, reason: "RATE_LIMIT_REDIS_URL unset" };
  }

  const unavailable = createUnavailableRateLimitStore();
  const outage = await unavailable.check("any", 1, 1_000);
  try {
    throwIfRateLimited(outage);
    report.failClosedOutage = { ok: false, detail: "expected 503 throw" };
  } catch (err) {
    report.failClosedOutage = {
      ok: err instanceof Error && err.message.includes("Abuse protection"),
      httpSemantic: "503 SERVICE_UNAVAILABLE on store_unavailable",
    };
  }

  const smokeEmail: {
    prepared: boolean;
    willSend: boolean;
    instruction: string;
    executed?: boolean;
    blockedReason?: string;
    resultStage?: string;
    recipient?: string;
  } = {
    prepared: Boolean(apiKey && fromAddress),
    willSend:
      raw.RESEND_SMOKE_AUTHORIZED === "1" &&
      Boolean(raw.RESEND_SMOKE_TO?.trim()) &&
      raw.RESEND_SMOKE_TEST === "1",
    instruction:
      "Set RESEND_SMOKE_TEST=1, RESEND_SMOKE_TO=<recipient>, RESEND_SMOKE_AUTHORIZED=1 then re-run with --smoke to send one message (owner authorization required).",
  };
  report.smokeEmail = smokeEmail;

  if (process.argv.includes("--smoke")) {
    if (smokeEmail.willSend !== true) {
      smokeEmail.executed = false;
      smokeEmail.blockedReason =
        "Smoke send blocked — set RESEND_SMOKE_AUTHORIZED=1 and RESEND_SMOKE_TO explicitly.";
    } else {
      const { createResendEmailSender } =
        await import("../src/modules/auth/resend-email-sender.js");
      const pino = (await import("pino")).default;
      const sender = createResendEmailSender({
        apiKey: apiKey!,
        fromAddress: fromAddress!,
        logger: pino({ level: "silent" }),
        maxRetries: 0,
      });
      const to = raw.RESEND_SMOKE_TO!.trim();
      const result = await sender.send({
        to,
        subject: "StrangeUp provider smoke (authorized)",
        text: "StrangeUp Task 019B one-recipient smoke test.",
        idempotencyKey: `smoke:${Date.now()}`,
      });
      smokeEmail.executed = true;
      smokeEmail.resultStage = result.stage;
      smokeEmail.recipient = maskEmail(to);
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
