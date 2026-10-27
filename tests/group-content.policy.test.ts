import { describe, expect, it } from "vitest";
import { buildTestEnv } from "./helpers/test-app.js";
import {
  assertGroupCommunityInteractiveEnabled,
  computeStoryExpiresAt,
  isStoryExpired,
} from "../src/modules/group-content/group-content-policy.js";
import { AppError } from "../src/common/errors/app-error.js";

describe("group-content policy", () => {
  it("fails closed when interactive flag is off", () => {
    const env = buildTestEnv({ GROUP_COMMUNITY_INTERACTIVE_ENABLED: false });
    expect(() => assertGroupCommunityInteractiveEnabled(env)).toThrow(AppError);
    try {
      assertGroupCommunityInteractiveEnabled(env);
    } catch (e) {
      expect(e).toMatchObject({ code: "FEATURE_DISABLED", statusCode: 403 });
    }
  });

  it("allows when interactive flag is on", () => {
    const env = buildTestEnv({ GROUP_COMMUNITY_INTERACTIVE_ENABLED: true });
    expect(() => assertGroupCommunityInteractiveEnabled(env)).not.toThrow();
  });

  it("computes 24h story expiry from server createdAt", () => {
    const created = new Date("2026-01-01T12:00:00.000Z");
    const expires = computeStoryExpiresAt(created);
    expect(expires.toISOString()).toBe("2026-01-02T12:00:00.000Z");
    expect(isStoryExpired(expires, new Date("2026-01-02T12:00:00.000Z"))).toBe(true);
    expect(isStoryExpired(expires, new Date("2026-01-02T11:59:59.999Z"))).toBe(false);
  });
});
