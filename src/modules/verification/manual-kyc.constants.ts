export const MANUAL_KYC_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;

export const MANUAL_KYC_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ManualKycStoredContentType = "image/jpeg" | "image/png" | "image/webp";

export function cloudinaryDeliveryFormat(
  contentType: ManualKycStoredContentType,
): "png" | "jpg" | "webp" {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default: {
      const _exhaustive: never = contentType;
      return _exhaustive;
    }
  }
}
