import { describe, expect, it } from "vitest";
import { buildSettingsCapabilities } from "../src/modules/settings/settings-capabilities.js";

describe("buildSettingsCapabilities", () => {
  it("marks deferred hub rows honestly", () => {
    const caps = buildSettingsCapabilities();
    expect(caps.twoFactorAuth).toBe("DEFERRED");
    expect(caps.membershipPlanCatalog).toBe("LIVE");
    expect(caps.subscription).toBe("DEFERRED");
    expect(caps.accountDeletion).toBe("UNAVAILABLE");
    expect(caps.emailChange).toBe("DEV_ONLY");
    expect(caps.sessionInventory).toBe("LIVE");
  });
});
