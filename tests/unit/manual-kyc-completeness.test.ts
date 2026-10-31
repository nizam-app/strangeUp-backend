import { describe, expect, it } from "vitest";
import { computeManualEvidenceComplete } from "../../src/modules/verification/manual-kyc-completeness.js";

describe("manual-kyc-completeness", () => {
  it("marks passport flow complete with front + selfie only", () => {
    const result = computeManualEvidenceComplete({
      manualIdDocumentType: "PASSPORT",
      uploadedKinds: ["ID_DOCUMENT", "SELFIE"],
    });
    expect(result.evidenceComplete).toBe(true);
    expect(result.missingKinds).toEqual([]);
  });

  it("requires back for license when documentHasRearSide is true", () => {
    const partial = computeManualEvidenceComplete({
      manualIdDocumentType: "DRIVERS_LICENSE",
      manualIdDocumentHasRearSide: true,
      uploadedKinds: ["ID_DOCUMENT", "SELFIE"],
    });
    expect(partial.evidenceComplete).toBe(false);
    expect(partial.missingKinds).toEqual(["ID_DOCUMENT_BACK"]);

    const complete = computeManualEvidenceComplete({
      manualIdDocumentType: "DRIVERS_LICENSE",
      manualIdDocumentHasRearSide: true,
      uploadedKinds: ["ID_DOCUMENT", "ID_DOCUMENT_BACK", "SELFIE"],
    });
    expect(complete.evidenceComplete).toBe(true);
  });

  it("does not require back for license when documentHasRearSide is false", () => {
    const result = computeManualEvidenceComplete({
      manualIdDocumentType: "NATIONAL_ID",
      manualIdDocumentHasRearSide: false,
      uploadedKinds: ["ID_DOCUMENT", "SELFIE"],
    });
    expect(result.evidenceComplete).toBe(true);
  });

  it("is incomplete when document type is missing", () => {
    const result = computeManualEvidenceComplete({
      manualIdDocumentType: null,
      uploadedKinds: ["ID_DOCUMENT"],
    });
    expect(result.evidenceComplete).toBe(false);
    expect(result.requiredEvidenceKinds).toEqual([]);
  });
});
