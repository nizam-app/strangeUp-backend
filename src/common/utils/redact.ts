const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|api[_-]?key|database_url|connectionstring)/i;

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return "[Truncated]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (value.startsWith("postgresql://") || value.startsWith("postgres://")) {
      return "[REDACTED_DATABASE_URL]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactSensitive(val, depth + 1);
      }
    }
    return out;
  }

  return value;
}
