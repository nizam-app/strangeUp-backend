import type {
  ManualIdDocumentType,
  ManualKycEvidenceKind,
} from "../../../generated/prisma/client.js";
import { requiredManualEvidenceKinds } from "./manual-kyc-document-type.js";

export function computeManualEvidenceComplete(input: {
  manualIdDocumentType: ManualIdDocumentType | null;
  manualIdDocumentHasRearSide?: boolean | null;
  uploadedKinds: ManualKycEvidenceKind[];
}): {
  requiredEvidenceKinds: ManualKycEvidenceKind[];
  evidenceComplete: boolean;
  missingKinds: ManualKycEvidenceKind[];
} {
  if (!input.manualIdDocumentType) {
    return {
      requiredEvidenceKinds: [],
      evidenceComplete: false,
      missingKinds: [],
    };
  }
  const required = requiredManualEvidenceKinds({
    documentType: input.manualIdDocumentType,
    documentHasRearSide: input.manualIdDocumentHasRearSide,
  });
  const present = new Set(input.uploadedKinds);
  const missingKinds = required.filter((kind) => !present.has(kind));
  return {
    requiredEvidenceKinds: required,
    evidenceComplete: missingKinds.length === 0,
    missingKinds,
  };
}
