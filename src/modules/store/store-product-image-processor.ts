import sharp from "sharp";
import { AppError } from "../../common/errors/app-error.js";
import type { AvatarStoredContentType } from "../profile-media/avatar.constants.js";
import {
  STORE_PRODUCT_IMAGE_MAX_DIMENSION,
  STORE_PRODUCT_IMAGE_MAX_INPUT_PIXELS,
  STORE_PRODUCT_IMAGE_MAX_STORED_BYTES,
} from "./store-product-image.constants.js";

export type ProcessedStoreProductImage = {
  buffer: Buffer;
  contentType: AvatarStoredContentType;
};

const ALLOWED_SHARP_FORMATS = new Set(["jpeg", "png", "webp"]);

function contentTypeForFormat(format: string): AvatarStoredContentType {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
}

export async function processStoreProductImageUpload(
  input: Buffer,
): Promise<ProcessedStoreProductImage> {
  if (input.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, {
      limitInputPixels: STORE_PRODUCT_IMAGE_MAX_INPUT_PIXELS,
      failOn: "error",
    }).metadata();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }

  const format = meta.format;
  if (!format || !ALLOWED_SHARP_FORMATS.has(format)) {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }

  const contentType = contentTypeForFormat(format);

  const pipeline = sharp(input, {
    limitInputPixels: STORE_PRODUCT_IMAGE_MAX_INPUT_PIXELS,
    failOn: "error",
  })
    .rotate()
    .resize({
      width: STORE_PRODUCT_IMAGE_MAX_DIMENSION,
      height: STORE_PRODUCT_IMAGE_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  const buffer = await pipeline.toBuffer();
  if (buffer.length > STORE_PRODUCT_IMAGE_MAX_STORED_BYTES) {
    throw new AppError("VALIDATION_ERROR", "Image exceeds maximum allowed size", 400);
  }

  return { buffer, contentType };
}
