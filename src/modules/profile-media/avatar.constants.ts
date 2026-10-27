export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Post-process output cap (re-encoded bytes). */
export const AVATAR_MAX_STORED_BYTES = 5 * 1024 * 1024;

/** Decompression bomb guard — max decoded pixels (width × height). */
export const AVATAR_MAX_INPUT_PIXELS = 4096 * 4096;

/** Longest edge after resize (EXIF-aware auto-orient applied before measure). */
export const AVATAR_MAX_DIMENSION = 2048;

export const AVATAR_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type AvatarStoredContentType = "image/jpeg" | "image/png" | "image/webp";
