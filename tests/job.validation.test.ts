import { describe, expect, it } from "vitest";
import {
  createJobDraftBodySchema,
  submitJobApplicationBodySchema,
} from "../src/modules/jobs/job.validation.js";

describe("job.validation", () => {
  it("requires application consent version", () => {
    expect(() =>
      submitJobApplicationBodySchema.parse({
        coverMessage: "Interested in the role",
      }),
    ).toThrow();
  });

  it("accepts minimal job draft", () => {
    const parsed = createJobDraftBodySchema.parse({
      title: "Ride Guide",
      description: "Lead weekend rides",
      companyDisplayName: "Example Co",
      employmentType: "PART_TIME",
    });
    expect(parsed.employmentType).toBe("PART_TIME");
  });

  it("rejects invalid pay currency", () => {
    expect(() =>
      createJobDraftBodySchema.parse({
        title: "T",
        description: "D",
        companyDisplayName: "C",
        employmentType: "FULL_TIME",
        payMinCents: 1000,
        payCurrency: "usd",
      }),
    ).toThrow();
  });
});
