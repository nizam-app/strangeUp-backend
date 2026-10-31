export type KycEvidenceUploadInput = {
  /** Server-generated public id (never from client). */
  publicId: string;
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

export type KycEvidenceStoredObject = {
  publicId: string;
  resourceType: "image";
  deliveryType: "authenticated";
  bytes: number;
};

export type KycEvidenceFetchResult = {
  body: Buffer;
  contentType: string;
};

/** Private KYC evidence boundary — Cloudinary authenticated assets or in-memory test double. */
export interface KycEvidenceStore {
  putAuthenticatedEvidence(input: KycEvidenceUploadInput): Promise<KycEvidenceStoredObject>;
  fetchAuthenticatedEvidence(
    publicId: string,
    format: "png" | "jpg" | "webp",
  ): Promise<KycEvidenceFetchResult>;
  deleteEvidence(publicId: string): Promise<void>;
}
