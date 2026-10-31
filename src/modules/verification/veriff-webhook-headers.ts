export function extractWebhookHmacSignature(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const pick = (name: string): string | undefined => {
    const value = headers[name];
    if (typeof value === "string") {
      return value;
    }
    if (Array.isArray(value) && value[0]) {
      return value[0];
    }
    return undefined;
  };

  return pick("x-hmac-signature") ?? pick("vrf-hmac-signature") ?? pick("x-signature");
}

export function extractVeriffAuthClientHeader(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const value = headers["x-auth-client"];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value[0]) {
    return value[0];
  }
  return undefined;
}
