import { describe, expect, it } from "vitest";
import { AppError } from "../src/common/errors/app-error.js";
import {
  assertStoreCatalogManagementEnabled,
  isStoreCatalogManagementEnabled,
} from "../src/modules/store/store-catalog-policy.js";
import { buildTestEnv } from "./helpers/test-app.js";

describe("store catalog management policy (024B)", () => {
  it("defaults to disabled", () => {
    expect(isStoreCatalogManagementEnabled(buildTestEnv())).toBe(false);
  });

  it("throws FEATURE_DISABLED when off", () => {
    const env = buildTestEnv({ STORE_CATALOG_MANAGEMENT_ENABLED: false });
    expect(() => assertStoreCatalogManagementEnabled(env)).toThrow(AppError);
    try {
      assertStoreCatalogManagementEnabled(env);
    } catch (e) {
      expect(e).toMatchObject({ code: "FEATURE_DISABLED", statusCode: 403 });
    }
  });

  it("allows when enabled in non-production test env", () => {
    expect(() =>
      assertStoreCatalogManagementEnabled(buildTestEnv({ STORE_CATALOG_MANAGEMENT_ENABLED: true })),
    ).not.toThrow();
  });
});
