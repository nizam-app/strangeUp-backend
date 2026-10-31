import { describe, expect, it } from "vitest";
import {
  manualIdDocumentRearDeclarationRequired,
  manualIdDocumentRequiresBackSide,
  requiredManualEvidenceKinds,
  isEvidenceKindAllowedForDocument,
} from "../../src/modules/verification/manual-kyc-document-type.js";

describe("manual-kyc-document-type", () => {
  it("requires rear declaration for license/state/national ID types", () => {
    expect(manualIdDocumentRearDeclarationRequired("DRIVERS_LICENSE")).toBe(true);
    expect(manualIdDocumentRearDeclarationRequired("PASSPORT")).toBe(false);
  });

  it("requires back only when applicant declares rear side on variable types", () => {
    expect(
      manualIdDocumentRequiresBackSide({
        documentType: "DRIVERS_LICENSE",
        documentHasRearSide: true,
      }),
    ).toBe(true);
    expect(
      requiredManualEvidenceKinds({
        documentType: "DRIVERS_LICENSE",
        documentHasRearSide: true,
      }),
    ).toEqual(["ID_DOCUMENT", "ID_DOCUMENT_BACK", "SELFIE"]);
    expect(
      requiredManualEvidenceKinds({
        documentType: "DRIVERS_LICENSE",
        documentHasRearSide: false,
      }),
    ).toEqual(["ID_DOCUMENT", "SELFIE"]);
  });

  it("does not require back for passport or one-sided types", () => {
    expect(
      manualIdDocumentRequiresBackSide({ documentType: "PASSPORT", documentHasRearSide: null }),
    ).toBe(false);
    expect(
      isEvidenceKindAllowedForDocument({
        documentType: "PASSPORT",
        kind: "ID_DOCUMENT_BACK",
      }),
    ).toBe(false);
  });

  it("always requires back for OTHER_TWO_SIDED", () => {
    expect(requiredManualEvidenceKinds({ documentType: "OTHER_TWO_SIDED" })).toEqual([
      "ID_DOCUMENT",
      "ID_DOCUMENT_BACK",
      "SELFIE",
    ]);
  });
});
