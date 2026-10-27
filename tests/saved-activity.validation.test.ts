import { describe, expect, it } from "vitest";
import {
  savedActivityIdParamSchema,
  savedActivityListQuerySchema,
} from "../src/modules/saved-activities/saved-activity.validation.js";

describe("savedActivityListQuerySchema", () => {
  it("accepts empty query", () => {
    expect(savedActivityListQuerySchema.parse({})).toEqual({});
  });

  it("rejects unknown keys", () => {
    expect(() => savedActivityListQuerySchema.parse({ foo: 1 })).toThrow();
  });
});

describe("savedActivityIdParamSchema", () => {
  it("requires uuid activityId", () => {
    expect(() => savedActivityIdParamSchema.parse({ activityId: "not-uuid" })).toThrow();
  });
});
