import { describe, expect, it } from "vitest";
import {
  buildVeriffProviderEventId,
  mapVeriffDecisionToSessionStatus,
  trustedUserDecisionBlockedReason,
} from "../src/modules/verification/veriff-decision.js";

describe("Veriff decision mapping", () => {
  it("maps documented decision statuses to session statuses", () => {
    expect(mapVeriffDecisionToSessionStatus("approved")).toBe("APPROVED");
    expect(mapVeriffDecisionToSessionStatus("declined")).toBe("DECLINED");
    expect(mapVeriffDecisionToSessionStatus("resubmission_requested")).toBe(
      "RESUBMISSION_REQUESTED",
    );
    expect(mapVeriffDecisionToSessionStatus("review")).toBe("IN_REVIEW");
    expect(mapVeriffDecisionToSessionStatus("expired")).toBe("EXPIRED");
    expect(mapVeriffDecisionToSessionStatus("abandoned")).toBe("ABANDONED");
  });

  it("builds stable provider event ids for idempotent webhook receipt", () => {
    const id = buildVeriffProviderEventId({
      providerSessionRef: "123e4567-e89b-12d3-a456-426614174000",
      decisionStatus: "approved",
      decisionTime: "2019-11-06T07:18:36.916Z",
    });
    expect(id).toBe(
      "veriff:123e4567-e89b-12d3-a456-426614174000:approved:2019-11-06T07:18:36.916Z",
    );
  });

  it("blocks trusted user approval for revoked identity or superseded sessions", () => {
    const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const otherSessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const createdAt = new Date("2026-01-01T00:00:00.000Z");

    expect(
      trustedUserDecisionBlockedReason({
        decisionStatus: "APPROVED",
        sessionId,
        sessionCreatedAt: createdAt,
        userIdentityRevokedAt: new Date(),
        userIdentityVerificationSessionId: null,
        hasNewerVerificationSession: false,
      }),
    ).toBe("identity_revoked");

    expect(
      trustedUserDecisionBlockedReason({
        decisionStatus: "APPROVED",
        sessionId,
        sessionCreatedAt: createdAt,
        userIdentityRevokedAt: null,
        userIdentityVerificationSessionId: null,
        hasNewerVerificationSession: true,
      }),
    ).toBe("superseded_by_newer_session");

    expect(
      trustedUserDecisionBlockedReason({
        decisionStatus: "APPROVED",
        sessionId,
        sessionCreatedAt: createdAt,
        userIdentityRevokedAt: null,
        userIdentityVerificationSessionId: otherSessionId,
        hasNewerVerificationSession: false,
      }),
    ).toBe("bound_to_other_trusted_session");

    expect(
      trustedUserDecisionBlockedReason({
        decisionStatus: "DECLINED",
        sessionId,
        sessionCreatedAt: createdAt,
        userIdentityRevokedAt: new Date(),
        userIdentityVerificationSessionId: otherSessionId,
        hasNewerVerificationSession: true,
      }),
    ).toBeNull();
  });
});
