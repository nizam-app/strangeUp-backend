import type { VerificationRuntimeConfig } from "./verification-config.js";
import { AppError } from "../../common/errors/app-error.js";

export type VeriffSessionCreateResult = {
  providerSessionRef: string;
  sdkToken: string;
  redirectUrl: string | null;
};

/**
 * Veriff session creation — implemented but blocked until owner approves KYC-02
 * and VERIFF_LIVE_CALLS_ENABLED is explicitly set for sandbox/production activation.
 */
export function createVeriffProviderSession(
  _config: VerificationRuntimeConfig,
  _input: { userId: string; locale?: string },
): Promise<VeriffSessionCreateResult> {
  return Promise.reject(
    new AppError(
      "SERVICE_UNAVAILABLE",
      "Veriff integration is not authorized for live session creation",
      503,
    ),
  );
}
