import { describe, expect, it } from "vitest";
import {
  storeCartItemBodySchema,
  storeProductListQuerySchema,
} from "../src/modules/store/store.validation.js";

describe("store.validation", () => {
  it("accepts bounded product list query", () => {
    const parsed = storeProductListQuerySchema.parse({
      q: "jersey",
      category: "cycling",
      limit: "10",
    });
    expect(parsed.limit).toBe(10);
    expect(parsed.q).toBe("jersey");
  });

  it("rejects cart quantity above cap", () => {
    expect(() => storeCartItemBodySchema.parse({ quantity: 100 })).toThrow();
  });

  it("allows zero quantity for line removal", () => {
    expect(storeCartItemBodySchema.parse({ quantity: 0 }).quantity).toBe(0);
  });
});
