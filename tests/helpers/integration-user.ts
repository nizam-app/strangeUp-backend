import type { Application } from "express";
import request from "supertest";
import { expect } from "vitest";
import type { DatabaseClient } from "../../src/infrastructure/database/prisma.js";
import type { createCapturingEmailSender } from "./capturing-email-sender.js";
import { extractVerificationTokenFromText } from "./capturing-email-sender.js";
import { seedMainAppActivatedUser } from "./kyc-applicant.js";

export const DEFAULT_INTEGRATION_CONSENTS = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
] as const;

export type IntegrationUserOptions = {
  /** When false, user stays email-verified only (onboarding-safe APIs). Default true. */
  mainAppAccess?: boolean;
  profileVisibility?: "EVERYONE" | "VERIFIED_USERS_ONLY";
  /** Legacy partial KYC override after registration (does not grant main app unless paired with admin). */
  kyc?: "APPROVED" | "PENDING" | "REJECTED" | "NOT_STARTED";
  dateOfBirth?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
};

export type IntegrationUserResult = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  email: string;
};

export async function createIntegrationUser(
  app: Application,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  db: DatabaseClient,
  prefix: string,
  options: IntegrationUserOptions = {},
): Promise<IntegrationUserResult> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const password = options.password ?? "ValidPass1";
  const register = await request(app)
    .post("/v1/auth/register")
    .send({
      firstName: options.firstName ?? "Test",
      lastName: options.lastName ?? "User",
      email,
      password,
      dateOfBirth: options.dateOfBirth ?? "1995-06-15",
      consents: [...DEFAULT_INTEGRATION_CONSENTS],
    });
  expect(register.status).toBe(201);

  const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
  expect(token).toBeTruthy();
  const confirm = await request(app).post("/v1/auth/email-verification/confirm").send({ token });
  expect(confirm.status).toBe(200);

  const login = await request(app).post("/v1/auth/login").send({ email, password });
  expect(login.status).toBe(200);
  const userId = login.body.data.user.id as string;
  const accessToken = login.body.data.accessToken as string;
  const refreshToken = login.body.data.refreshToken as string;

  if (options.profileVisibility) {
    await db.profile.update({
      where: { userId },
      data: { profileVisibility: options.profileVisibility },
    });
  }

  const grantMainApp = options.mainAppAccess !== false;
  if (grantMainApp) {
    await seedMainAppActivatedUser(db, userId);
  } else if (options.kyc && options.kyc !== "NOT_STARTED") {
    await db.user.update({
      where: { id: userId },
      data: { identityVerificationStatus: options.kyc },
    });
  } else if (options.kyc === "NOT_STARTED") {
    await db.user.update({
      where: { id: userId },
      data: { identityVerificationStatus: "NOT_STARTED" },
    });
  }

  return { userId, accessToken, refreshToken, email };
}

/** Email verify + login only (interest catalog, onboarding tests). */
export async function createEmailVerifiedIntegrationUser(
  app: Application,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  prefix: string,
  options: Omit<IntegrationUserOptions, "mainAppAccess"> = {},
): Promise<Pick<IntegrationUserResult, "accessToken" | "email">> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const password = options.password ?? "ValidPass1";
  await request(app)
    .post("/v1/auth/register")
    .send({
      firstName: options.firstName ?? "Test",
      lastName: options.lastName ?? "User",
      email,
      password,
      dateOfBirth: options.dateOfBirth ?? "1995-06-15",
      consents: [...DEFAULT_INTEGRATION_CONSENTS],
    });
  const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
  expect(token).toBeTruthy();
  const confirm = await request(app).post("/v1/auth/email-verification/confirm").send({ token });
  expect(confirm.status).toBe(200);
  const login = await request(app).post("/v1/auth/login").send({ email, password });
  expect(login.status).toBe(200);
  return { accessToken: login.body.data.accessToken as string, email };
}
