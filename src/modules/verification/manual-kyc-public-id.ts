import { randomUUID } from "node:crypto";
import type { ManualKycEvidenceKind } from "../../../generated/prisma/client.js";

export function buildManualEvidencePublicId(input: {
  folder: string;
  userId: string;
  sessionId: string;
  kind: ManualKycEvidenceKind;
  evidenceId?: string;
}): string {
  const folder = input.folder.replace(/\/+$/, "");
  const evidenceId = input.evidenceId ?? randomUUID();
  return `${folder}/${input.userId}/${input.sessionId}/${input.kind.toLowerCase()}/${evidenceId}`;
}
