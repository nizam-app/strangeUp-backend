import type { IdentityVerificationStatus } from "../../../generated/prisma/client.js";

export type ActivityKycEnforcementContext = {
  isProduction: boolean;
  kycProviderEnabled: boolean;
};

/**
 * Current trusted government-ID KYC for real-world activity actions (KYC-03 / KYC-ENF).
 * Production fails closed until a provider-backed approval path exists.
 * Email verification is never treated as KYC.
 */
export function hasCurrentTrustedKycForEnforcement(
  identityVerificationStatus: IdentityVerificationStatus,
  ctx: ActivityKycEnforcementContext,
): boolean {
  if (ctx.isProduction && !ctx.kycProviderEnabled) {
    return false;
  }
  return identityVerificationStatus === "APPROVED";
}
