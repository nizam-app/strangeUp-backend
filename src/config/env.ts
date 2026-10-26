import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1).optional(),
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    JSON_BODY_LIMIT: z.string().default("100kb"),
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .strict();

const KNOWN_ENV_KEYS = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "CORS_ORIGINS",
  "LOG_LEVEL",
  "JSON_BODY_LIMIT",
  "TRUST_PROXY",
] as const;

export type AppEnv = z.infer<typeof envSchema> & {
  corsOriginsList: string[];
  isProduction: boolean;
};

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function buildEnvInput(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const input: Record<string, string | undefined> = {};
  for (const key of KNOWN_ENV_KEYS) {
    const value = raw[key];
    if (value !== undefined) {
      input[key] = value;
    }
  }
  return input;
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  if (raw !== process.env) {
    for (const key of Object.keys(raw)) {
      if (!(KNOWN_ENV_KEYS as readonly string[]).includes(key)) {
        throw new Error(`Invalid environment configuration: unrecognized key ${key}`);
      }
    }
  }

  const parsed = envSchema.safeParse(buildEnvInput(raw));
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const base = parsed.data;
  const nodeEnv = base.NODE_ENV;

  if (nodeEnv !== "test" && !base.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required when NODE_ENV is not test (set it in .env or the process environment)",
    );
  }

  return {
    ...base,
    corsOriginsList: parseCorsOrigins(base.CORS_ORIGINS),
    isProduction: nodeEnv === "production",
  };
}
