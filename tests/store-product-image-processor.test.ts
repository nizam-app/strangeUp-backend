import { describe, expect, it } from "vitest";
import { processStoreProductImageUpload } from "../src/modules/store/store-product-image-processor.js";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("processStoreProductImageUpload", () => {
  it("accepts valid PNG", async () => {
    const result = await processStoreProductImageUpload(TINY_PNG);
    expect(result.contentType).toBe("image/png");
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
