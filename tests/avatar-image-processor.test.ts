import { describe, expect, it } from "vitest";
import { processAvatarUpload } from "../src/modules/profile-media/avatar-image-processor.js";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("processAvatarUpload", () => {
  it("accepts a valid PNG and returns image/png", async () => {
    const result = await processAvatarUpload(TINY_PNG);
    expect(result.contentType).toBe("image/png");
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("rejects SVG even when labeled as image/png", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
    );
    await expect(processAvatarUpload(svg)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects empty buffer", async () => {
    await expect(processAvatarUpload(Buffer.alloc(0))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects corrupt bytes", async () => {
    await expect(processAvatarUpload(Buffer.from("not-an-image"))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});
