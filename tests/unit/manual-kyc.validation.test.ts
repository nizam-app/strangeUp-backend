import { describe, expect, it } from "vitest";
import { startManualVerificationSessionBodySchema } from "../../src/modules/verification/manual-kyc.validation.js";

describe("startManualVerificationSessionBodySchema", () => {
  it("requires documentHasRearSide for drivers license", () => {
    const fail = startManualVerificationSessionBodySchema.safeParse({
      idDocumentType: "DRIVERS_LICENSE",
    });
    expect(fail.success).toBe(false);

    const ok = startManualVerificationSessionBodySchema.safeParse({
      idDocumentType: "DRIVERS_LICENSE",
      documentHasRearSide: true,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects documentHasRearSide for passport", () => {
    const fail = startManualVerificationSessionBodySchema.safeParse({
      idDocumentType: "PASSPORT",
      documentHasRearSide: false,
    });
    expect(fail.success).toBe(false);
  });
});
