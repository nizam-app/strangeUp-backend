import { randomUUID } from "node:crypto";
import type { VerificationRuntimeConfig } from "./verification-config.js";

export type MockSessionCreateResult = {
  providerSessionRef: string;
  sdkToken: string;
  redirectUrl: string | null;
};

export function createMockProviderSession(
  _config: VerificationRuntimeConfig,
): MockSessionCreateResult {
  const providerSessionRef = randomUUID();
  const sdkToken = randomUUID();
  return {
    providerSessionRef,
    sdkToken,
    redirectUrl: null,
  };
}
