import type { AppEnv } from "../../config/env.js";
import { CloudinaryKycEvidenceStore } from "./cloudinary-kyc-evidence-store.js";
import { resolveCloudinaryKycConfig } from "./cloudinary-config.js";
import { InMemoryKycEvidenceStore } from "./in-memory-kyc-evidence-store.js";
import type { KycEvidenceStore } from "./kyc-evidence-store.types.js";

export function createKycEvidenceStore(env: AppEnv): KycEvidenceStore {
  if (env.NODE_ENV === "test") {
    const cloudinary = resolveCloudinaryKycConfig(env);
    if (cloudinary) {
      return new CloudinaryKycEvidenceStore(cloudinary);
    }
    return new InMemoryKycEvidenceStore();
  }
  const cloudinary = resolveCloudinaryKycConfig(env);
  if (!cloudinary) {
    return new InMemoryKycEvidenceStore();
  }
  return new CloudinaryKycEvidenceStore(cloudinary);
}
