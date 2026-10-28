import type { ConsentType } from "../../../generated/prisma/client.js";

type NormalizedRegistrationConsent = {
  consentType: ConsentType;
  documentId: string;
  versionId: string;
};

/** Counsel-owned registry entry — no legal copy stored here. */
export type CanonicalConsentVersionStatus = "ACTIVE" | "SUPERSEDED" | "UNAVAILABLE" | "PLACEHOLDER";

export type CanonicalConsentVersion = {
  versionId: string;
  status: CanonicalConsentVersionStatus;
  /** ISO-8601 instant when this version becomes enforceable; null until counsel publishes. */
  effectiveFrom: string | null;
  resourceUrl: string | null;
  contentHash: string | null;
};

export type CanonicalConsentDocument = {
  documentId: string;
  consentType: ConsentType | null;
  /** Non-registration slots (e.g. job application attestation). */
  slot: "REGISTRATION" | "JOB_APPLICATION" | "KYC_FLOW";
  versions: CanonicalConsentVersion[];
};

/**
 * Owner-approved canonical IDs are not configured for production registration yet.
 * PLACEHOLDER versions exist only for non-production engineering until counsel publishes ACTIVE IDs.
 */
export const CANONICAL_CONSENT_DOCUMENTS: readonly CanonicalConsentDocument[] = [
  {
    documentId: "STRANGEUP_TERMS_OF_SERVICE",
    consentType: "TERMS",
    slot: "REGISTRATION",
    versions: [
      {
        versionId: "pending-legal-review",
        status: "PLACEHOLDER",
        effectiveFrom: null,
        resourceUrl: null,
        contentHash: null,
      },
    ],
  },
  {
    documentId: "STRANGEUP_PRIVACY_POLICY",
    consentType: "PRIVACY",
    slot: "REGISTRATION",
    versions: [
      {
        versionId: "pending-legal-review",
        status: "PLACEHOLDER",
        effectiveFrom: null,
        resourceUrl: null,
        contentHash: null,
      },
    ],
  },
  {
    documentId: "STRANGEUP_AGE_ATTESTATION",
    consentType: "AGE_ATTESTATION",
    slot: "REGISTRATION",
    versions: [
      {
        versionId: "pending-legal-review",
        status: "PLACEHOLDER",
        effectiveFrom: null,
        resourceUrl: null,
        contentHash: null,
      },
    ],
  },
  {
    documentId: "STRANGEUP_JOB_APPLICATION_CONSENT",
    consentType: null,
    slot: "JOB_APPLICATION",
    versions: [
      {
        versionId: "pending-legal-review",
        status: "PLACEHOLDER",
        effectiveFrom: null,
        resourceUrl: null,
        contentHash: null,
      },
    ],
  },
  {
    documentId: "STRANGEUP_KYC_DATA_PROCESSING",
    consentType: null,
    slot: "KYC_FLOW",
    versions: [
      {
        versionId: "pending-legal-review",
        status: "UNAVAILABLE",
        effectiveFrom: null,
        resourceUrl: null,
        contentHash: null,
      },
    ],
  },
] as const;

export type ConsentEnforcementMode = "strict" | "placeholder_allowed";

export type ConsentRegistryContext = {
  enforcementMode: ConsentEnforcementMode;
  now: Date;
};

export type ResolvedConsentRequirement = {
  documentId: string;
  consentType: ConsentType | null;
  slot: CanonicalConsentDocument["slot"];
  required: boolean;
  availability: "AVAILABLE" | "UNAVAILABLE" | "PLACEHOLDER";
  activeVersionId: string | null;
  effectiveFrom: string | null;
  resourceUrl: string | null;
  contentHash: string | null;
};

function versionIsAcceptable(
  version: CanonicalConsentVersion,
  ctx: ConsentRegistryContext,
): boolean {
  if (version.status === "UNAVAILABLE" || version.status === "SUPERSEDED") {
    return false;
  }
  if (version.status === "ACTIVE") {
    if (version.effectiveFrom) {
      const effective = Date.parse(version.effectiveFrom);
      if (!Number.isNaN(effective) && effective > ctx.now.getTime()) {
        return false;
      }
    }
    return true;
  }
  if (version.status === "PLACEHOLDER") {
    return ctx.enforcementMode === "placeholder_allowed";
  }
  return false;
}

export function resolveActiveVersion(
  document: CanonicalConsentDocument,
  ctx: ConsentRegistryContext,
): CanonicalConsentVersion | null {
  const acceptable = document.versions.filter((v) => versionIsAcceptable(v, ctx));
  if (acceptable.length === 0) {
    return null;
  }
  const active = acceptable.find((v) => v.status === "ACTIVE");
  if (active) {
    return active;
  }
  return acceptable[0] ?? null;
}

export function listRegistrationRequirements(
  ctx: ConsentRegistryContext,
): ResolvedConsentRequirement[] {
  return CANONICAL_CONSENT_DOCUMENTS.filter((d) => d.slot === "REGISTRATION").map((doc) => {
    const active = resolveActiveVersion(doc, ctx);
    const availability: ResolvedConsentRequirement["availability"] = active
      ? active.status === "PLACEHOLDER"
        ? "PLACEHOLDER"
        : "AVAILABLE"
      : "UNAVAILABLE";
    return {
      documentId: doc.documentId,
      consentType: doc.consentType,
      slot: doc.slot,
      required: true,
      availability,
      activeVersionId: active?.versionId ?? null,
      effectiveFrom: active?.effectiveFrom ?? null,
      resourceUrl: active?.resourceUrl ?? null,
      contentHash: active?.contentHash ?? null,
    };
  });
}

export function resolveJobApplicationRequirement(
  ctx: ConsentRegistryContext,
): ResolvedConsentRequirement | null {
  const doc = CANONICAL_CONSENT_DOCUMENTS.find((d) => d.slot === "JOB_APPLICATION");
  if (!doc) {
    return null;
  }
  const active = resolveActiveVersion(doc, ctx);
  return {
    documentId: doc.documentId,
    consentType: doc.consentType,
    slot: doc.slot,
    required: true,
    availability: active
      ? active.status === "PLACEHOLDER"
        ? "PLACEHOLDER"
        : "AVAILABLE"
      : "UNAVAILABLE",
    activeVersionId: active?.versionId ?? null,
    effectiveFrom: active?.effectiveFrom ?? null,
    resourceUrl: active?.resourceUrl ?? null,
    contentHash: active?.contentHash ?? null,
  };
}

export type ConsentAcceptanceInput = {
  type: string;
  version: string;
};

export type CanonicalConsentValidationResult =
  | {
      ok: true;
      normalized: NormalizedRegistrationConsent[];
    }
  | { ok: false; code: string; message: string };

export function validateRegistrationConsents(
  consents: ConsentAcceptanceInput[],
  ctx: ConsentRegistryContext,
): CanonicalConsentValidationResult {
  const registrationDocs = CANONICAL_CONSENT_DOCUMENTS.filter((d) => d.slot === "REGISTRATION");
  const seenTypes = new Set<string>();
  const normalized: NormalizedRegistrationConsent[] = [];

  for (const item of consents) {
    if (seenTypes.has(item.type)) {
      return {
        ok: false,
        code: "CONSENT_DUPLICATE",
        message: `Duplicate consent acceptance for ${item.type}`,
      };
    }
    seenTypes.add(item.type);

    const doc = registrationDocs.find((d) => d.consentType === item.type);
    if (!doc) {
      return {
        ok: false,
        code: "CONSENT_UNKNOWN_TYPE",
        message: `Unknown consent type: ${item.type}`,
      };
    }

    const versionEntry = doc.versions.find((v) => v.versionId === item.version.trim());
    if (!versionEntry || !versionIsAcceptable(versionEntry, ctx)) {
      return {
        ok: false,
        code: "CONSENT_VERSION_INVALID",
        message: `Consent version not accepted for ${item.type}`,
      };
    }

    normalized.push({
      consentType: doc.consentType!,
      documentId: doc.documentId,
      versionId: versionEntry.versionId,
    });
  }

  for (const doc of registrationDocs) {
    if (!doc.consentType || !seenTypes.has(doc.consentType)) {
      return {
        ok: false,
        code: "CONSENT_MISSING",
        message: `Missing required consent: ${doc.consentType}`,
      };
    }
  }

  return { ok: true, normalized };
}

export type StoredConsentRecord = {
  consentType: ConsentType;
  documentId: string | null;
  documentVersion: string;
};

/** Whether persisted registration consents satisfy the current canonical registry. */
export function userRegistrationConsentsSatisfyRegistry(
  records: StoredConsentRecord[],
  ctx: ConsentRegistryContext,
):
  | { ok: true }
  | { ok: false; code: "CONSENT_MISSING" | "CONSENT_VERSION_INVALID" | "CONSENT_VERSION_UNAVAILABLE"; message: string } {
  const requirements = listRegistrationRequirements(ctx);
  for (const req of requirements) {
    if (req.availability === "UNAVAILABLE" || !req.activeVersionId || !req.consentType) {
      return {
        ok: false,
        code: "CONSENT_VERSION_UNAVAILABLE",
        message: `Required consent ${req.documentId} is not available for enforcement`,
      };
    }
    const match = records.find((r) => r.consentType === req.consentType);
    if (!match) {
      return {
        ok: false,
        code: "CONSENT_MISSING",
        message: `Missing required consent record: ${req.consentType}`,
      };
    }
    if (match.documentVersion !== req.activeVersionId) {
      return {
        ok: false,
        code: "CONSENT_VERSION_INVALID",
        message: `Consent ${req.consentType} version is not current`,
      };
    }
    if (req.documentId && match.documentId && match.documentId !== req.documentId) {
      return {
        ok: false,
        code: "CONSENT_VERSION_INVALID",
        message: `Consent ${req.consentType} documentId mismatch`,
      };
    }
  }
  return { ok: true };
}

export function validateJobApplicationConsentVersion(
  version: string,
  ctx: ConsentRegistryContext,
):
  | { ok: true; documentId: string; versionId: string }
  | { ok: false; code: string; message: string } {
  const requirement = resolveJobApplicationRequirement(ctx);
  if (!requirement?.activeVersionId) {
    return {
      ok: false,
      code: "CONSENT_VERSION_UNAVAILABLE",
      message:
        "Job application consent is not available until counsel publishes canonical versions",
    };
  }
  const trimmed = version.trim();
  if (trimmed !== requirement.activeVersionId) {
    return {
      ok: false,
      code: "CONSENT_VERSION_INVALID",
      message: "Job application consent version is not current",
    };
  }
  return {
    ok: true,
    documentId: requirement.documentId,
    versionId: requirement.activeVersionId,
  };
}
