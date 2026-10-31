import { AppError } from "../../common/errors/app-error.js";
import type { CloudinaryKycConfig } from "./cloudinary-config.js";
import { cloudinaryApiSignature } from "./cloudinary-signature.js";
import type {
  KycEvidenceFetchResult,
  KycEvidenceStore,
  KycEvidenceStoredObject,
  KycEvidenceUploadInput,
} from "./kyc-evidence-store.types.js";

export type FetchLike = typeof fetch;

const AUTHENTICATED_TYPE = "authenticated";

function assertPublicIdScoped(publicId: string, folder: string): void {
  const normalizedFolder = folder.replace(/\/+$/, "");
  if (!publicId.startsWith(`${normalizedFolder}/`)) {
    throw new AppError("VALIDATION_ERROR", "Invalid evidence object reference", 400);
  }
  if (publicId.includes("..")) {
    throw new AppError("VALIDATION_ERROR", "Invalid evidence object reference", 400);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AppError("SERVICE_UNAVAILABLE", "Cloudinary request timed out", 503));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export class CloudinaryKycEvidenceStore implements KycEvidenceStore {
  constructor(
    private readonly config: CloudinaryKycConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async putAuthenticatedEvidence(input: KycEvidenceUploadInput): Promise<KycEvidenceStoredObject> {
    assertPublicIdScoped(input.publicId, this.config.evidenceFolder);
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureParams = {
      folder: this.config.evidenceFolder,
      public_id: input.publicId,
      timestamp,
      type: AUTHENTICATED_TYPE,
      access_mode: AUTHENTICATED_TYPE,
    };
    const signature = cloudinaryApiSignature(signatureParams, this.config.apiSecret);

    const form = new FormData();
    form.set(
      "file",
      new Blob([new Uint8Array(input.body)], { type: input.contentType }),
      "evidence",
    );
    form.set("api_key", this.config.apiKey);
    form.set("timestamp", String(timestamp));
    form.set("signature", signature);
    form.set("folder", this.config.evidenceFolder);
    form.set("public_id", input.publicId);
    form.set("type", AUTHENTICATED_TYPE);
    form.set("access_mode", AUTHENTICATED_TYPE);

    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.config.cloudName)}/image/upload`;
    const response = await withTimeout(
      this.fetchImpl(url, { method: "POST", body: form }),
      this.config.requestTimeoutMs,
    );
    if (!response.ok) {
      throw new AppError("SERVICE_UNAVAILABLE", "Unable to store KYC evidence", 503);
    }
    const payload = (await response.json()) as {
      bytes?: number;
      public_id?: string;
      type?: string;
    };
    if (payload.type !== AUTHENTICATED_TYPE || !payload.public_id) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Cloudinary rejected authenticated evidence upload",
        503,
      );
    }
    return {
      publicId: payload.public_id,
      resourceType: "image",
      deliveryType: AUTHENTICATED_TYPE,
      bytes: payload.bytes ?? input.body.length,
    };
  }

  async fetchAuthenticatedEvidence(
    publicId: string,
    format: "png" | "jpg" | "webp",
  ): Promise<KycEvidenceFetchResult> {
    assertPublicIdScoped(publicId, this.config.evidenceFolder);
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureParams = {
      public_id: publicId,
      timestamp,
      type: AUTHENTICATED_TYPE,
      format,
    };
    const signature = cloudinaryApiSignature(signatureParams, this.config.apiSecret);
    const query = new URLSearchParams({
      public_id: publicId,
      api_key: this.config.apiKey,
      timestamp: String(timestamp),
      signature,
      type: AUTHENTICATED_TYPE,
      format,
    });
    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.config.cloudName)}/image/download?${query.toString()}`;
    const response = await withTimeout(
      this.fetchImpl(url, { method: "GET", redirect: "follow" }),
      this.config.requestTimeoutMs,
    );
    if (response.status === 404) {
      throw new AppError("NOT_FOUND", "KYC evidence not found", 404);
    }
    if (!response.ok) {
      throw new AppError("SERVICE_UNAVAILABLE", "Unable to retrieve KYC evidence", 503);
    }
    const body = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    return { body, contentType };
  }

  async deleteEvidence(publicId: string): Promise<void> {
    assertPublicIdScoped(publicId, this.config.evidenceFolder);
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureParams = {
      public_id: publicId,
      timestamp,
      type: AUTHENTICATED_TYPE,
    };
    const signature = cloudinaryApiSignature(signatureParams, this.config.apiSecret);
    const form = new FormData();
    form.set("public_id", publicId);
    form.set("api_key", this.config.apiKey);
    form.set("timestamp", String(timestamp));
    form.set("signature", signature);
    form.set("type", AUTHENTICATED_TYPE);

    const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.config.cloudName)}/image/destroy`;
    const response = await withTimeout(
      this.fetchImpl(url, { method: "POST", body: form }),
      this.config.requestTimeoutMs,
    );
    if (!response.ok) {
      throw new AppError("SERVICE_UNAVAILABLE", "Unable to delete KYC evidence", 503);
    }
  }
}
