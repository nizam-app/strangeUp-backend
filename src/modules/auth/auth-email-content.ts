import { AppError } from "../../common/errors/app-error.js";

export type AuthEmailPurpose = "email_verify" | "password_reset" | "email_change_confirm";

const PURPOSE_COPY: Record<AuthEmailPurpose, { subject: string; linkLabel: string }> = {
  email_verify: {
    subject: "Verify your StrangeUp email",
    linkLabel: "Verify your email",
  },
  password_reset: {
    subject: "Reset your StrangeUp password",
    linkLabel: "Reset your password",
  },
  email_change_confirm: {
    subject: "Confirm your new StrangeUp email",
    linkLabel: "Confirm your new email",
  },
};

export function authEmailSubject(purpose: AuthEmailPurpose): string {
  return PURPOSE_COPY[purpose].subject;
}

/**
 * Builds transactional email body. Raw tokens appear only when `allowDevTokenFallback` is true (non-production dev stub).
 */
export function buildAuthChallengeEmailText(params: {
  purpose: AuthEmailPurpose;
  token: string;
  publicAppBaseUrl?: string;
  path: string;
  allowDevTokenFallback: boolean;
}): string {
  const baseUrl = params.publicAppBaseUrl?.replace(/\/$/, "");
  if (baseUrl) {
    const link = `${baseUrl}${params.path}?token=${encodeURIComponent(params.token)}`;
    return `${PURPOSE_COPY[params.purpose].linkLabel}: ${link}`;
  }
  if (params.allowDevTokenFallback) {
    const devLabel =
      params.purpose === "email_verify"
        ? "verification"
        : params.purpose === "password_reset"
          ? "password reset"
          : "email change";
    return `Your ${devLabel} token (dev delivery): ${params.token}`;
  }
  throw new AppError(
    "EMAIL_TRANSPORT_UNAVAILABLE",
    "Transactional email cannot be sent without PUBLIC_APP_BASE_URL and an approved provider",
    503,
  );
}

export function buildPriorEmailChangedNoticeText(): string {
  return (
    "Your StrangeUp account email address was changed. " +
    "If you did not request this, contact support immediately."
  );
}
