import type { AppEnv } from "../../config/env.js";

export type CloudinaryKycConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  evidenceFolder: string;
  requestTimeoutMs: number;
};

export function resolveCloudinaryKycConfig(env: AppEnv): CloudinaryKycConfig | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }
  return {
    cloudName,
    apiKey,
    apiSecret,
    evidenceFolder: env.CLOUDINARY_KYC_EVIDENCE_FOLDER,
    requestTimeoutMs: env.CLOUDINARY_REQUEST_TIMEOUT_MS,
  };
}
