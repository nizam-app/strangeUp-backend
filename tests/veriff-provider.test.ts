import { describe, expect, it, vi } from "vitest";
import {
  createVeriffProviderSession,
  type VeriffHttpClient,
} from "../src/modules/verification/veriff-provider.js";
import type { VerificationRuntimeConfig } from "../src/modules/verification/verification-config.js";

const readyConfig: VerificationRuntimeConfig = {
  providerEnabled: true,
  provider: "VERIFF",
  runtimeStatus: "VERIFF_READY",
  webhookBodyLimitBytes: 65_536,
  sessionTtlSeconds: 3600,
  veriffApiKey: "test-api-key",
  veriffSharedSecret: "test-shared-secret-min-32-characters!!",
  veriffBaseUrl: "https://stationapi.veriff.com",
  veriffLiveCallsAllowed: true,
};

describe("createVeriffProviderSession", () => {
  it("rejects live session creation when Veriff is not authorized", async () => {
    await expect(
      createVeriffProviderSession(
        { ...readyConfig, runtimeStatus: "VERIFF_BLOCKED_BY_OWNER", veriffLiveCallsAllowed: false },
        { userId: "123e4567-e89b-12d3-a456-426614174000" },
      ),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("maps Veriff session response fields for mobile SDK launch", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: "success",
            verification: {
              id: "123e4567-e89b-12d3-a456-426614174000",
              url: "https://magic.veriff.me/v/abc123",
              sessionToken: "token-abc",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    const fetchFn: VeriffHttpClient = fetchMock;

    const result = await createVeriffProviderSession(
      readyConfig,
      { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { fetchFn },
    );

    expect(result.providerSessionRef).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.sdkToken).toBe("token-abc");
    expect(result.redirectUrl).toBe("https://magic.veriff.me/v/abc123");

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["X-AUTH-CLIENT"]).toBe("test-api-key");
    expect(JSON.parse(init?.body as string)).toEqual({
      verification: { endUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    });
  });

  it("sanitizes provider 401 responses without leaking secrets", async () => {
    const fetchFn: VeriffHttpClient = vi.fn((_url: string) =>
      Promise.resolve(new Response("unauthorized", { status: 401 })),
    );
    await expect(
      createVeriffProviderSession(
        readyConfig,
        { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        { fetchFn },
      ),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Identity verification provider rejected credentials",
    });
  });

  it("retries retryable provider failures once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "success",
            verification: {
              id: "123e4567-e89b-12d3-a456-426614174000",
              url: "https://magic.veriff.me/v/abc123",
              sessionToken: "token-abc",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    const fetchFn: VeriffHttpClient = fetchMock;

    await createVeriffProviderSession(
      readyConfig,
      { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { fetchFn },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
