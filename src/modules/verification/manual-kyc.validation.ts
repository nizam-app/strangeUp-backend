import { z } from "zod";
import {
  MANUAL_ID_DOCUMENT_TYPES,
  manualIdDocumentRearDeclarationRequired,
} from "./manual-kyc-document-type.js";

export const manualKycEvidenceKindSchema = z.enum(["ID_DOCUMENT", "ID_DOCUMENT_BACK", "SELFIE"]);

export const manualIdDocumentTypeSchema = z.enum(MANUAL_ID_DOCUMENT_TYPES);

export const startManualVerificationSessionBodySchema = z
  .object({
    idDocumentType: manualIdDocumentTypeSchema,
    documentHasRearSide: z.boolean().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    const needsDeclaration = manualIdDocumentRearDeclarationRequired(body.idDocumentType);
    if (needsDeclaration) {
      if (typeof body.documentHasRearSide !== "boolean") {
        ctx.addIssue({
          code: "custom",
          message:
            "documentHasRearSide is required for this document type (declare whether your ID has a readable rear side)",
          path: ["documentHasRearSide"],
        });
      }
      return;
    }
    if (body.documentHasRearSide !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "documentHasRearSide must not be sent for this document type",
        path: ["documentHasRearSide"],
      });
    }
  });

export const manualIdentityStaffDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reasonCode: z.string().min(1).max(64).optional(),
});
