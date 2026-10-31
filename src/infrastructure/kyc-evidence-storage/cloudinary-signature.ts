import { createHash } from "node:crypto";

export function cloudinaryApiSignature(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${sorted}${apiSecret}`).digest("hex");
}
