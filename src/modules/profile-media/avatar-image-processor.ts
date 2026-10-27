import sharp from "sharp";
import { AppError } from "../../common/errors/app-error.js";
import {
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_INPUT_PIXELS,
  AVATAR_MAX_STORED_BYTES,
  type AvatarStoredContentType,
} from "./avatar.constants.js";

export type ProcessedAvatarImage = {
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

/**
 * Decode from bytes, reject non-raster formats (e.g. SVG), strip metadata via re-encode,
 * and bound dimensions / pixel count (decompression abuse).
 */
export async function processAvatarUpload(input: Buffer): Promise<ProcessedAvatarImage> {
  if (input.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, {
      limitInputPixels: AVATAR_MAX_INPUT_PIXELS,
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
    limitInputPixels: AVATAR_MAX_INPUT_PIXELS,
    failOn: "error",
  })
    .rotate()
    .resize({
      width: AVATAR_MAX_DIMENSION,
      height: AVATAR_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  const buffer =
    format === "jpeg"
      ? await pipeline.jpeg({ mozjpeg: true }).toBuffer()
      : format === "png"
        ? await pipeline.png().toBuffer()
        : await pipeline.webp().toBuffer();

  if (buffer.length === 0 || buffer.length > AVATAR_MAX_STORED_BYTES) {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }

  return { buffer, contentType };
}
