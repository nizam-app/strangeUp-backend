import { describe, expect, it } from "vitest";
import {
  validateJobApplicationConsentVersion,
  validateRegistrationConsents,
} from "../src/modules/consent/canonical-consent-registry.js";

const placeholderCtx = { enforcementMode: "placeholder_allowed" as const, now: new Date() };
const strictCtx = { enforcementMode: "strict" as const, now: new Date() };

const validRegistration = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

describe("canonical consent registry", () => {
  it("accepts placeholder versions only when placeholder enforcement is allowed", () => {
    expect(validateRegistrationConsents(validRegistration, placeholderCtx).ok).toBe(true);
    expect(validateRegistrationConsents(validRegistration, strictCtx).ok).toBe(false);
  });

  it("rejects unknown, duplicate, and stale versions", () => {
    expect(
      validateRegistrationConsents(
        [{ type: "TERMS", version: "v999" }, ...validRegistration.slice(1)],
        placeholderCtx,
      ).ok,
    ).toBe(false);
    expect(
      validateRegistrationConsents(
        [
          { type: "TERMS", version: "pending-legal-review" },
          { type: "TERMS", version: "pending-legal-review" },
          { type: "AGE_ATTESTATION", version: "pending-legal-review" },
        ],
        placeholderCtx,
      ).ok,
    ).toBe(false);
    expect(
      validateRegistrationConsents(
        [{ type: "TERMS", version: "pending-legal-review" }],
        placeholderCtx,
      ).ok,
    ).toBe(false);
  });

  it("validates job application consent against the registry", () => {
    expect(validateJobApplicationConsentVersion("pending-legal-review", placeholderCtx).ok).toBe(
      true,
    );
    expect(validateJobApplicationConsentVersion("unknown", placeholderCtx).ok).toBe(false);
    expect(validateJobApplicationConsentVersion("pending-legal-review", strictCtx).ok).toBe(false);
  });
});
