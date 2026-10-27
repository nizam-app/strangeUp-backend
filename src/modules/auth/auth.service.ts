import { randomUUID } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client.js";
import type { AccountStatus, ConsentType, User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AuthEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isAtLeast18UsaLaunch, parseBirthDateOnly } from "./age-eligibility.js";
import {
  constantTimeEqual,
  generateSecureToken,
  hashPassword,
  hashSha256,
  normalizeEmail,
  passwordHashNeedsUpgrade,
  verifyPassword,
} from "./crypto.js";
import type { EmailSender } from "./email-sender.js";
import { TokenService } from "./token.service.js";
import { validateRequiredConsents } from "./auth.validation.js";
import { hasFullAccountAccess, toPolicyActor } from "../policy/account-policy.js";

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth: string;
  consents: Array<{ type: ConsentType; version: string }>;
  ipHash?: string;
};

export type AuthTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export type SessionMeta = {
  userAgent?: string;
  ipHash?: string;
};

function isUserAuthBlocked(user: User): boolean {
  return (
    user.deletedAt !== null ||
    user.suspendedAt !== null ||
    user.accountStatus === "DELETED" ||
    user.accountStatus === "SUSPENDED"
  );
}

export class AuthService {
  private readonly tokenService: TokenService;

  constructor(
    private readonly db: DatabaseClient,
    private readonly authEnv: AuthEnv,
    private readonly emailSender: EmailSender,
  ) {
    this.tokenService = new TokenService(authEnv);
  }

  async register(input: RegisterInput): Promise<{
    userId: string;
    accountStatus: AccountStatus;
    emailVerificationRequired: true;
  }> {
    const consentError = validateRequiredConsents(input.consents);
    if (consentError) {
      throw new AppError("VALIDATION_ERROR", consentError, 400);
    }

    const birthDate = parseBirthDateOnly(input.dateOfBirth);
    if (!birthDate) {
      throw new AppError("VALIDATION_ERROR", "Invalid dateOfBirth (expected YYYY-MM-DD)", 400);
    }
    const todayUtc = new Date();
    const todayDateOnlyMs = Date.UTC(
      todayUtc.getUTCFullYear(),
      todayUtc.getUTCMonth(),
      todayUtc.getUTCDate(),
    );
    if (birthDate.getTime() > todayDateOnlyMs) {
      throw new AppError("VALIDATION_ERROR", "Invalid dateOfBirth (cannot be in the future)", 400);
    }
    if (!isAtLeast18UsaLaunch(birthDate)) {
      throw new AppError("VALIDATION_ERROR", "You must be at least 18 years old to register", 400);
    }

    const email = input.email.trim();
    const emailNormalized = normalizeEmail(email);
    const passwordHash = await hashPassword(input.password);
    const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

    try {
      const user = await this.db.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email,
            emailNormalized,
            accountStatus: "PENDING_VERIFICATION",
            ageEligibilityStatus: "ELIGIBLE",
            profile: {
              create: {
                firstName: input.firstName.trim(),
                lastName: input.lastName.trim(),
                displayName,
                birthDate,
              },
            },
            passwordCredential: {
              create: { passwordHash },
            },
            consentRecords: {
              create: input.consents.map((c) => ({
                consentType: c.type,
                documentVersion: c.version,
                ipHash: input.ipHash ?? null,
              })),
            },
          },
        });
        return created;
      });

      await this.createAndSendEmailVerification(user.id, emailNormalized, email);

      return {
        userId: user.id,
        accountStatus: user.accountStatus,
        emailVerificationRequired: true,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError("CONFLICT", "Unable to create account with these details", 409);
      }
      throw err;
    }
  }

  async login(
    email: string,
    password: string,
    meta: SessionMeta,
  ): Promise<{ tokens: AuthTokens; user: UserSummary }> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.db.user.findUnique({
      where: { emailNormalized },
      include: { passwordCredential: true },
    });

    if (!user?.passwordCredential) {
      throw new AppError("AUTH_INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    if (isUserAuthBlocked(user)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const storedHash = user.passwordCredential.passwordHash;
    const passwordOk = await verifyPassword(password, storedHash);
    if (!passwordOk) {
      throw new AppError("AUTH_INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    if (passwordHashNeedsUpgrade(storedHash)) {
      const passwordHash = await hashPassword(password);
      await this.db.passwordCredential.update({
        where: { userId: user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
    }

    const tokens = await this.createSession(user.id, meta);
    return { tokens, user: toUserSummary(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashSha256(refreshToken);
    const session = await this.db.session.findFirst({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) {
      const replay = await this.db.session.findFirst({
        where: { previousRefreshTokenHash: tokenHash },
      });
      if (replay) {
        await this.revokeSessionFamily(replay.familyId);
      }
      throw new AppError("AUTH_UNAUTHORIZED", "Invalid or expired refresh token", 401);
    }

    if (session.revokedAt) {
      throw new AppError("AUTH_UNAUTHORIZED", "Invalid or expired refresh token", 401);
    }
    if (session.expiresAt <= new Date()) {
      await this.revokeSessionFamily(session.familyId);
      throw new AppError("AUTH_UNAUTHORIZED", "Invalid or expired refresh token", 401);
    }

    const user = session.user;
    if (isUserAuthBlocked(user)) {
      await this.revokeSessionFamily(session.familyId);
      throw new AppError("AUTH_UNAUTHORIZED", "Invalid or expired refresh token", 401);
    }

    const newRefresh = generateSecureToken(48);
    const newHash = hashSha256(newRefresh);
    const newExpires = new Date(Date.now() + this.authEnv.REFRESH_TOKEN_TTL_SECONDS * 1000);

    const rotated = await this.db.session.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: tokenHash,
        revokedAt: null,
      },
      data: {
        previousRefreshTokenHash: tokenHash,
        refreshTokenHash: newHash,
        expiresAt: newExpires,
      },
    });

    if (rotated.count !== 1) {
      const replay = await this.db.session.findFirst({
        where: { previousRefreshTokenHash: tokenHash },
      });
      if (replay) {
        await this.revokeSessionFamily(replay.familyId);
      }
      throw new AppError("AUTH_UNAUTHORIZED", "Invalid or expired refresh token", 401);
    }

    const access = await this.tokenService.issueAccessToken(user.id, session.id);
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken: newRefresh,
      refreshTokenExpiresAt: newExpires.toISOString(),
    };
  }

  async logout(sessionId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = hashSha256(refreshToken);
      const session = await this.db.session.findFirst({
        where: { id: sessionId, refreshTokenHash: tokenHash },
      });
      if (session) {
        await this.db.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        return;
      }
    }
    await this.db.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) {
      return;
    }
    await this.createAndSendEmailVerification(user.id, user.emailNormalized, user.email);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const emailNormalized = normalizeEmail(email);
    const user = await this.db.user.findUnique({
      where: { emailNormalized },
      include: { passwordCredential: true },
    });

    if (!user?.passwordCredential || isUserAuthBlocked(user)) {
      return;
    }

    const rawToken = generateSecureToken(32);
    const secretHash = hashSha256(rawToken);
    const expiresAt = new Date(Date.now() + this.authEnv.AUTH_CHALLENGE_TTL_SECONDS * 1000);

    await this.db.authChallenge.deleteMany({
      where: { userId: user.id, type: "PASSWORD_RESET", consumedAt: null },
    });

    await this.db.authChallenge.create({
      data: {
        userId: user.id,
        type: "PASSWORD_RESET",
        target: emailNormalized,
        secretHash,
        expiresAt,
      },
    });

    const baseUrl = this.authEnv.PUBLIC_APP_BASE_URL;
    const linkHint =
      baseUrl !== undefined
        ? `${baseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`
        : null;
    const text =
      linkHint !== null
        ? `Use this link to reset your password (dev delivery): ${linkHint}`
        : `Your password reset token (dev delivery): ${rawToken}`;

    await this.emailSender.send({
      to: user.email,
      subject: "Reset your StrangeUp password",
      text,
    });
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashSha256(token);
    const challenge = await this.db.authChallenge.findFirst({
      where: {
        type: "PASSWORD_RESET",
        secretHash: tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: { passwordCredential: true } } },
    });

    if (!challenge?.user?.passwordCredential) {
      throw new AppError("AUTH_CHALLENGE_EXPIRED", "Reset link is invalid or expired", 400);
    }

    const user = challenge.user;
    if (isUserAuthBlocked(user)) {
      throw new AppError("AUTH_CHALLENGE_EXPIRED", "Reset link is invalid or expired", 400);
    }

    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    const consumed = await this.db.$transaction(async (tx) => {
      const mark = await tx.authChallenge.updateMany({
        where: {
          id: challenge.id,
          type: "PASSWORD_RESET",
          secretHash: tokenHash,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (mark.count !== 1) {
        return false;
      }
      await tx.passwordCredential.update({
        where: { userId: user.id },
        data: { passwordHash, passwordChangedAt: now },
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });

    if (!consumed) {
      throw new AppError("AUTH_CHALLENGE_EXPIRED", "Reset link is invalid or expired", 400);
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { passwordCredential: true },
    });

    if (!user?.passwordCredential || isUserAuthBlocked(user)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const storedHash = user.passwordCredential.passwordHash;
    const passwordOk = await verifyPassword(currentPassword, storedHash);
    if (!passwordOk) {
      throw new AppError("AUTH_INVALID_CREDENTIALS", "Invalid current password", 401);
    }

    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    const applied = await this.db.$transaction(async (tx) => {
      const updated = await tx.passwordCredential.updateMany({
        where: {
          userId,
          passwordHash: storedHash,
        },
        data: {
          passwordHash,
          passwordChangedAt: now,
          mustReauthAfter: now,
        },
      });
      if (updated.count !== 1) {
        return false;
      }
      await tx.authChallenge.deleteMany({
        where: { userId, type: "PASSWORD_RESET", consumedAt: null },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });

    if (!applied) {
      throw new AppError("CONFLICT", "Password could not be updated", 409);
    }
  }

  async confirmEmailVerification(token: string): Promise<{ accountStatus: AccountStatus }> {
    const tokenHash = hashSha256(token);
    const challenge = await this.db.authChallenge.findFirst({
      where: {
        type: "EMAIL_VERIFY",
        secretHash: tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!challenge?.user) {
      throw new AppError("AUTH_CHALLENGE_EXPIRED", "Verification link is invalid or expired", 400);
    }

    const user = challenge.user;
    const now = new Date();

    await this.db.$transaction(async (tx) => {
      await tx.authChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });
      const emailVerifiedAt = user.emailVerifiedAt ?? now;
      const accountStatus =
        user.ageEligibilityStatus === "ELIGIBLE" ? "ACTIVE" : user.accountStatus;
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt,
          accountStatus,
        },
      });
    });

    const updated = await this.db.user.findUniqueOrThrow({ where: { id: user.id } });
    return { accountStatus: updated.accountStatus };
  }

  async resolveAuthenticatedUser(accessToken: string): Promise<{ user: User; sessionId: string }> {
    let claims;
    try {
      claims = await this.tokenService.verifyAccessToken(accessToken);
    } catch {
      throw new AppError("AUTH_UNAUTHORIZED", "Invalid or expired access token", 401);
    }

    const session = await this.db.session.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.userId !== claims.sub) {
      throw new AppError("AUTH_UNAUTHORIZED", "Invalid or expired access token", 401);
    }
    if (session.expiresAt <= new Date()) {
      throw new AppError("AUTH_UNAUTHORIZED", "Invalid or expired access token", 401);
    }

    const user = session.user;
    if (isUserAuthBlocked(user)) {
      throw new AppError("AUTH_UNAUTHORIZED", "Invalid or expired access token", 401);
    }

    return { user, sessionId: session.id };
  }

  private async createSession(userId: string, meta: SessionMeta): Promise<AuthTokens> {
    const refreshToken = generateSecureToken(48);
    const refreshTokenHash = hashSha256(refreshToken);
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + this.authEnv.REFRESH_TOKEN_TTL_SECONDS * 1000);

    const session = await this.db.session.create({
      data: {
        userId,
        familyId,
        refreshTokenHash,
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ipHash: meta.ipHash ?? null,
      },
    });

    const access = await this.tokenService.issueAccessToken(userId, session.id);
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  private async revokeSessionFamily(familyId: string): Promise<void> {
    await this.db.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createAndSendEmailVerification(
    userId: string,
    emailNormalized: string,
    emailDisplay: string,
  ): Promise<void> {
    const rawToken = generateSecureToken(32);
    const secretHash = hashSha256(rawToken);
    const expiresAt = new Date(Date.now() + this.authEnv.AUTH_CHALLENGE_TTL_SECONDS * 1000);

    await this.db.authChallenge.deleteMany({
      where: { userId, type: "EMAIL_VERIFY", consumedAt: null },
    });

    await this.db.authChallenge.create({
      data: {
        userId,
        type: "EMAIL_VERIFY",
        target: emailNormalized,
        secretHash,
        expiresAt,
      },
    });

    await this.emailSender.send({
      to: emailDisplay,
      subject: "Verify your StrangeUp email",
      text: `Your verification token (dev delivery): ${rawToken}`,
    });
  }
}

export type UserSummary = {
  id: string;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  ageEligibilityStatus: string;
  identityVerificationStatus: string;
  fullAccess: boolean;
};

export function toUserSummary(user: User): UserSummary {
  const actor = toPolicyActor(user);
  return {
    id: user.id,
    accountStatus: user.accountStatus,
    emailVerified: user.emailVerifiedAt !== null,
    ageEligibilityStatus: user.ageEligibilityStatus,
    identityVerificationStatus: user.identityVerificationStatus,
    fullAccess: hasFullAccountAccess(actor),
  };
}

export async function consumeIdempotency(
  db: DatabaseClient,
  key: string,
  requestHash: string,
): Promise<string | null> {
  const row = await db.registerIdempotency.findUnique({ where: { id: key } });
  if (!row) {
    return null;
  }
  if (row.expiresAt <= new Date()) {
    await db.registerIdempotency.delete({ where: { id: key } });
    return null;
  }
  if (!constantTimeEqual(row.requestHash, requestHash)) {
    throw new AppError("CONFLICT", "Idempotency key reused with different payload", 409);
  }
  return row.responseJson;
}

export async function storeIdempotency(
  db: DatabaseClient,
  key: string,
  requestHash: string,
  responseJson: string,
  ttlHours = 24,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await db.registerIdempotency.create({
    data: { id: key, requestHash, responseJson, expiresAt },
  });
}
