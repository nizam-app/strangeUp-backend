import type {
  ManualIdDocumentType,
  ManualKycEvidenceKind,
} from "../../../generated/prisma/client.js";

/** Supported manual ID document types (applicant-declared at session start). */
export const MANUAL_ID_DOCUMENT_TYPES = [
  "PASSPORT",
  "NATIONAL_ID",
  "DRIVERS_LICENSE",
  "STATE_ID",
  "OTHER_ONE_SIDED",
  "OTHER_TWO_SIDED",
] as const satisfies readonly ManualIdDocumentType[];

/** Document classes where rear-side requirement is declared explicitly (not inferred from type alone). */
export const MANUAL_ID_DOCUMENT_TYPES_REAR_DECLARATION_REQUIRED = [
  "DRIVERS_LICENSE",
  "STATE_ID",
  "NATIONAL_ID",
] as const satisfies readonly ManualIdDocumentType[];

export function manualIdDocumentRearDeclarationRequired(
  documentType: ManualIdDocumentType,
): boolean {
  return (MANUAL_ID_DOCUMENT_TYPES_REAR_DECLARATION_REQUIRED as readonly string[]).includes(
    documentType,
  );
}

/**
 * Rear-side evidence policy (031I-M4):
 * - PASSPORT / OTHER_ONE_SIDED: never require back.
 * - OTHER_TWO_SIDED: always require back.
 * - DRIVERS_LICENSE / STATE_ID / NATIONAL_ID: require `documentHasRearSide` at session start;
 *   back upload required only when applicant declares true (conservative — no global inference).
 */
export function resolveManualIdDocumentRearSideRequired(input: {
  documentType: ManualIdDocumentType;
  documentHasRearSide: boolean | null | undefined;
}): boolean {
  switch (input.documentType) {
    case "PASSPORT":
    case "OTHER_ONE_SIDED":
      return false;
    case "OTHER_TWO_SIDED":
      return true;
    case "DRIVERS_LICENSE":
    case "STATE_ID":
    case "NATIONAL_ID":
      return input.documentHasRearSide === true;
    default: {
      const _exhaustive: never = input.documentType;
      return _exhaustive;
    }
  }
}

export function requiredManualEvidenceKinds(input: {
  documentType: ManualIdDocumentType;
  documentHasRearSide?: boolean | null;
}): ManualKycEvidenceKind[] {
  const kinds: ManualKycEvidenceKind[] = ["ID_DOCUMENT", "SELFIE"];
  if (
    resolveManualIdDocumentRearSideRequired({
      documentType: input.documentType,
      documentHasRearSide: input.documentHasRearSide,
    })
  ) {
    kinds.splice(1, 0, "ID_DOCUMENT_BACK");
  }
  return kinds;
}

export function isEvidenceKindAllowedForDocument(input: {
  documentType: ManualIdDocumentType;
  documentHasRearSide?: boolean | null;
  kind: ManualKycEvidenceKind;
}): boolean {
  const rearRequired = resolveManualIdDocumentRearSideRequired({
    documentType: input.documentType,
    documentHasRearSide: input.documentHasRearSide,
  });
  if (input.kind === "ID_DOCUMENT_BACK" && !rearRequired) {
    return false;
  }
  return requiredManualEvidenceKinds({
    documentType: input.documentType,
    documentHasRearSide: input.documentHasRearSide,
  }).includes(input.kind);
}

export function manualIdDocumentTypeLabel(documentType: ManualIdDocumentType): string {
  switch (documentType) {
    case "DRIVERS_LICENSE":
      return "Driver's license";
    case "STATE_ID":
      return "State / regional ID card";
    case "PASSPORT":
      return "Passport (bio/data page)";
    case "NATIONAL_ID":
      return "National ID card";
    case "OTHER_ONE_SIDED":
      return "Other one-sided ID";
    case "OTHER_TWO_SIDED":
      return "Other two-sided ID";
    default: {
      const _exhaustive: never = documentType;
      return _exhaustive;
    }
  }
}

/** @deprecated Use resolveManualIdDocumentRearSideRequired — kept for call-site clarity during transition */
export function manualIdDocumentRequiresBackSide(input: {
  documentType: ManualIdDocumentType;
  documentHasRearSide?: boolean | null;
}): boolean {
  return resolveManualIdDocumentRearSideRequired({
    documentType: input.documentType,
    documentHasRearSide: input.documentHasRearSide,
  });
}
