import { describe, expect, it } from "vitest";
import { assertEmailChangeAvailable } from "../src/modules/settings/settings-feature-gates.js";
import { buildTestEnv } from "./helpers/test-app.js";

describe("settings feature gates (Task 019)", () => {
  it("blocks email change when transactional email cannot hand off", () => {
    const env = buildTestEnv({
      isProduction: true,
      NODE_ENV: "production",
      transactionalEmail: {
        mode: "disabled",
        canHandOff: false,
        providerCredentialsPresent: false,
      },
    });
    expect(() => assertEmailChangeAvailable(env)).toThrow(/transactional email is configured/);
  });

  it("allows email change when dev stub transport is active", () => {
    const env = buildTestEnv({
      isProduction: false,
      NODE_ENV: "development",
      transactionalEmail: {
        mode: "dev_stub",
        canHandOff: true,
        providerCredentialsPresent: false,
      },
    });
    expect(() => assertEmailChangeAvailable(env)).not.toThrow();
  });
});
