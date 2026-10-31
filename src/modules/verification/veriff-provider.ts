import { z } from "zod";
import type { VerificationRuntimeConfig } from "./verification-config.js";
import { AppError } from "../../common/errors/app-error.js";

export type VeriffSessionCreateResult = {
  providerSessionRef: string;
  sdkToken: string;
  redirectUrl: string | null;
};

export type VeriffHttpClient = (url: string, init?: RequestInit) => Promise<Response>;

const VERIFF_SESSION_TIMEOUT_MS = 15_000;
const VERIFF_SESSION_MAX_RETRIES = 2;
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

const veriffCreateSessionResponseSchema = z.object({
  status: z.literal("success"),
  verification: z.object({
    id: z.string().uuid(),
    url: z.string().url(),
    sessionToken: z.string().min(1),
  }),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function assertVeriffSessionCreationAllowed(config: VerificationRuntimeConfig): void {
  if (config.runtimeStatus !== "VERIFF_READY" || !config.veriffLiveCallsAllowed) {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Veriff integration is not authorized for live session creation",
      503,
    );
  }
  if (!config.veriffApiKey?.trim() || !config.veriffSharedSecret?.trim() || !config.veriffBaseUrl) {
    throw new AppError("SERVICE_UNAVAILABLE", "Veriff credentials are not configured", 503);
  }
}

function sanitizeVeriffProviderError(status: number): AppError {
  if (status === 401 || status === 403) {
    return new AppError(
      "SERVICE_UNAVAILABLE",
      "Identity verification provider rejected credentials",
      503,
    );
  }
  if (status === 429) {
    return new AppError(
      "SERVICE_UNAVAILABLE",
      "Identity verification provider is rate limited",
      503,
    );
  }
  if (status >= 400 && status < 500) {
    return new AppError(
      "SERVICE_UNAVAILABLE",
      "Identity verification provider rejected the session request",
      503,
    );
  }
  return new AppError(
    "SERVICE_UNAVAILABLE",
    "Identity verification provider is temporarily unavailable",
    503,
  );
}

/**
 * Creates a Veriff session via POST /v1/sessions (Public API v1).
 * POST /sessions does not require an outbound HMAC signature per Veriff docs.
 */
export async function createVeriffProviderSession(
  config: VerificationRuntimeConfig,
  input: { userId: string; locale?: string },
  deps: { fetchFn?: VeriffHttpClient } = {},
): Promise<VeriffSessionCreateResult> {
  void input.locale;
  assertVeriffSessionCreationAllowed(config);

  const apiKey = config.veriffApiKey!.trim();
  const baseUrl = config.veriffBaseUrl!.replace(/\/+$/, "");
  const fetchFn = deps.fetchFn ?? globalThis.fetch.bind(globalThis);

  const payload = {
    verification: {
      endUserId: input.userId,
    },
  };

  const bodyText = JSON.stringify(payload);
  const url = `${baseUrl}/v1/sessions`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= VERIFF_SESSION_MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      await sleep(200 * attempt);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VERIFF_SESSION_TIMEOUT_MS);

    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AUTH-CLIENT": apiKey,
        },
        body: bodyText,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (RETRYABLE_HTTP_STATUS.has(response.status) && attempt < VERIFF_SESSION_MAX_RETRIES) {
          continue;
        }
        throw sanitizeVeriffProviderError(response.status);
      }

      let parsedJson: unknown;
      try {
        parsedJson = await response.json();
      } catch {
        throw new AppError(
          "SERVICE_UNAVAILABLE",
          "Identity verification provider returned an invalid response",
          503,
        );
      }

      const parsed = veriffCreateSessionResponseSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new AppError(
          "SERVICE_UNAVAILABLE",
          "Identity verification provider returned an unexpected session shape",
          503,
        );
      }

      return {
        providerSessionRef: parsed.data.verification.id,
        sdkToken: parsed.data.verification.sessionToken,
        redirectUrl: parsed.data.verification.url,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof AppError) {
        throw error;
      }
      if (attempt < VERIFF_SESSION_MAX_RETRIES) {
        continue;
      }
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Identity verification provider is temporarily unavailable",
        503,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }
  throw new AppError(
    "SERVICE_UNAVAILABLE",
    "Identity verification provider is temporarily unavailable",
    503,
  );
}
