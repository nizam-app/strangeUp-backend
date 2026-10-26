import type { ConsentType, Profile, User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import {
  canAccessAccount,
  canEditProfile,
  hasFullAccountAccess,
  toPolicyActor,
} from "../policy/account-policy.js";
import type { ProfilePatchInput } from "./me.validation.js";

export type AccountDto = {
  id: string;
  email: string;
  accountStatus: User["accountStatus"];
  emailVerified: boolean;
  ageEligibilityStatus: User["ageEligibilityStatus"];
  identityVerificationStatus: User["identityVerificationStatus"];
  fullAccess: boolean;
  createdAt: string;
  updatedAt: string;
  consents: Array<{ type: ConsentType; version: string; recordedAt: string }>;
};

export type ProfileDto = {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  bio: string | null;
  scheduleTimeZone: string | null;
  birthDate: string;
};

function formatBirthDate(profile: Profile): string {
  const d = profile.birthDate;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toProfileDto(profile: Profile): ProfileDto {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.displayName,
    bio: profile.bio,
    scheduleTimeZone: profile.scheduleTimeZone,
    birthDate: formatBirthDate(profile),
  };
}

export class MeService {
  constructor(private readonly db: DatabaseClient) {}

  async getAccount(user: User): Promise<AccountDto> {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const consents = await this.db.consentRecord.findMany({
      where: { userId: user.id },
      orderBy: { recordedAt: "asc" },
    });

    return {
      id: user.id,
      email: user.email,
      accountStatus: user.accountStatus,
      emailVerified: user.emailVerifiedAt !== null,
      ageEligibilityStatus: user.ageEligibilityStatus,
      identityVerificationStatus: user.identityVerificationStatus,
      fullAccess: hasFullAccountAccess(actor),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      consents: consents.map((c) => ({
        type: c.consentType,
        version: c.documentVersion,
        recordedAt: c.recordedAt.toISOString(),
      })),
    };
  }

  async getProfile(user: User): Promise<ProfileDto> {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const profile = await this.db.profile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      throw new AppError("NOT_FOUND", "Profile not found", 404);
    }
    return toProfileDto(profile);
  }

  async patchProfile(user: User, input: ProfilePatchInput): Promise<ProfileDto> {
    const actor = toPolicyActor(user);
    if (!canEditProfile(actor, user.id)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Profile cannot be edited in the current account state",
        403,
      );
    }

    const data: Partial<
      Pick<Profile, "firstName" | "lastName" | "displayName" | "bio" | "scheduleTimeZone">
    > = {};
    if (input.firstName !== undefined) {
      data.firstName = input.firstName;
    }
    if (input.lastName !== undefined) {
      data.lastName = input.lastName;
    }
    if (input.displayName !== undefined) {
      data.displayName = input.displayName;
    }
    if (input.bio !== undefined) {
      data.bio = input.bio;
    }
    if (input.scheduleTimeZone !== undefined) {
      data.scheduleTimeZone = input.scheduleTimeZone;
    }

    const profile = await this.db.profile.update({
      where: { userId: user.id },
      data,
    });
    return toProfileDto(profile);
  }
}
