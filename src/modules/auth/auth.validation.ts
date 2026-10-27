import { z } from "zod";

const consentSchema = z.object({
  type: z.enum(["TERMS", "PRIVACY", "AGE_ATTESTATION"]),
  version: z.string().trim().min(1).max(128),
});

export const passwordFieldSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/, "password must include a letter")
  .regex(/[0-9]/, "password must include a number");

export const registerBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(320),
    password: passwordFieldSchema,
    dateOfBirth: z.string().trim(),
    consents: z.array(consentSchema).min(1),
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(128),
  })
  .strict();

export const refreshBodySchema = z
  .object({
    refreshToken: z.string().min(1).max(512),
  })
  .strict();

export const logoutBodySchema = z
  .object({
    refreshToken: z.string().min(1).max(512).optional(),
  })
  .strict();

export const emailVerifyConfirmSchema = z
  .object({
    token: z.string().min(1).max(512),
  })
  .strict();

export const passwordResetRequestSchema = z
  .object({
    email: z.string().trim().email().max(320),
  })
  .strict();

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().min(1).max(512),
    newPassword: passwordFieldSchema,
  })
  .strict();

export const passwordChangeBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordFieldSchema,
  })
  .strict()
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must differ from current password",
    path: ["newPassword"],
  });

export const REQUIRED_CONSENT_TYPES = ["TERMS", "PRIVACY", "AGE_ATTESTATION"] as const;

export function validateRequiredConsents(
  consents: Array<{ type: string; version: string }>,
): string | null {
  const types = new Set(consents.map((c) => c.type));
  for (const required of REQUIRED_CONSENT_TYPES) {
    if (!types.has(required)) {
      return `Missing required consent: ${required}`;
    }
  }
  return null;
}
