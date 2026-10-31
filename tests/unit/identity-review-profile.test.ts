import { describe, expect, it } from "vitest";
import {
  profileHasAvatar,
  resolveIdentityReviewDisplayName,
} from "../../src/modules/admin/identity-review-profile.js";

describe("identity-review-profile helpers", () => {
  it("prefers displayName over composed name", () => {
    expect(
      resolveIdentityReviewDisplayName({
        displayName: "  Elena R.  ",
        firstName: "Elena",
        lastName: "Rostova",
        avatarStorageKey: null,
        locationCity: null,
        locationRegion: null,
      }),
    ).toBe("Elena R.");
  });

  it("composes first and last when displayName empty", () => {
    expect(
      resolveIdentityReviewDisplayName({
        displayName: null,
        firstName: "Elena",
        lastName: "Rostova",
        avatarStorageKey: null,
        locationCity: null,
        locationRegion: null,
      }),
    ).toBe("Elena Rostova");
  });

  it("returns null when profile missing", () => {
    expect(resolveIdentityReviewDisplayName(null)).toBeNull();
    expect(profileHasAvatar(null)).toBe(false);
  });
});
