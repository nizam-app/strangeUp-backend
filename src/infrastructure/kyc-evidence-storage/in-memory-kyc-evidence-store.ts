import { AppError } from "../../common/errors/app-error.js";
import type {
  KycEvidenceFetchResult,
  KycEvidenceStore,
  KycEvidenceStoredObject,
  KycEvidenceUploadInput,
} from "./kyc-evidence-store.types.js";

type Stored = {
  body: Buffer;
  contentType: string;
  deliveryType: "authenticated";
};

export class InMemoryKycEvidenceStore implements KycEvidenceStore {
  private readonly objects = new Map<string, Stored>();

  putAuthenticatedEvidence(input: KycEvidenceUploadInput): Promise<KycEvidenceStoredObject> {
    this.objects.set(input.publicId, {
      body: Buffer.from(input.body),
      contentType: input.contentType,
      deliveryType: "authenticated",
    });
    return Promise.resolve({
      publicId: input.publicId,
      resourceType: "image",
      deliveryType: "authenticated",
      bytes: input.body.length,
    });
  }

  fetchAuthenticatedEvidence(
    publicId: string,
    _format: "png" | "jpg" | "webp",
  ): Promise<KycEvidenceFetchResult> {
    const stored = this.objects.get(publicId);
    if (!stored) {
      return Promise.reject(new AppError("NOT_FOUND", "KYC evidence not found", 404));
    }
    return Promise.resolve({ body: Buffer.from(stored.body), contentType: stored.contentType });
  }

  deleteEvidence(publicId: string): Promise<void> {
    this.objects.delete(publicId);
    return Promise.resolve();
  }
}
