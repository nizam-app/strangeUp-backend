import { describe, expect, it } from "vitest";
import {
  identityReviewInternalNoteBodySchema,
  INTERNAL_NOTE_MAX_LENGTH,
} from "../../src/modules/admin/identity-admin-review-note.validation.js";

describe("identity-admin-review-note.validation", () => {
  it("accepts trimmed note body within limits", () => {
    const parsed = identityReviewInternalNoteBodySchema.parse({
      body: "  Escalated for second look.  ",
    });
    expect(parsed.body).toBe("Escalated for second look.");
  });

  it("rejects empty and oversized notes", () => {
    expect(() => identityReviewInternalNoteBodySchema.parse({ body: "   " })).toThrow();
    expect(() =>
      identityReviewInternalNoteBodySchema.parse({
        body: "x".repeat(INTERNAL_NOTE_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });
});
