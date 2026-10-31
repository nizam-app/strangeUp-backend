import { Prisma } from "../../../generated/prisma/client.js";
import type { ConsentType, Profile, User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import {
  canAccessAccount,
  canEditProfile,
  hasFullAccountAccess,
  toPolicyActor,
} from "../policy/account-policy.js";
import type { KycEnforcementContext } from "../verification/kyc-trust.js";
import { buildKycEnforcementContext } from "../verification/kyc-identity-authority.js";
import { profilePatchTouchesLegalName, resolveLegalNameLocked } from "./profile-identity-policy.js";
import { normalizeUsername } from "./username.js";
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
  username: string | null;
  bio: string | null;
  scheduleTimeZone: string | null;
  profileVisibility: Profile["profileVisibility"];
  locationCity: string | null;
  locationRegion: string | null;
  hasAvatar: boolean;
  avatarUpdatedAt: string | null;
  birthDate: string;
  /** True when trusted provider KYC binds legal first/last name (read-only in PATCH). */
  legalNameLocked: boolean;
};

function formatBirthDate(profile: Profile): string {
  const d = profile.birthDate;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function toProfileDto(
  profile: Profile,
  user: User,
  kyc: KycEnforcementContext,
  db: DatabaseClient,
): Promise<ProfileDto> {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.displayName,
    username: profile.username,
    bio: profile.bio,
    scheduleTimeZone: profile.scheduleTimeZone,
    profileVisibility: profile.profileVisibility,
    locationCity: profile.locationCity,
    locationRegion: profile.locationRegion,
    hasAvatar: profile.avatarStorageKey !== null,
    avatarUpdatedAt: profile.avatarUpdatedAt?.toISOString() ?? null,
    birthDate: formatBirthDate(profile),
    legalNameLocked: await resolveLegalNameLocked(db, user, kyc),
  };
}

export class MeService {
  private readonly kyc: KycEnforcementContext;

  constructor(
    private readonly db: DatabaseClient,
    env: AppEnv,
  ) {
    this.kyc = buildKycEnforcementContext(env);
  }

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
    return toProfileDto(profile, user, this.kyc, this.db);
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

    if (
      profilePatchTouchesLegalName(input) &&
      (await resolveLegalNameLocked(this.db, user, this.kyc))
    ) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Legal first and last name cannot be changed after identity verification",
        403,
      );
    }

    const data: Partial<
      Pick<
        Profile,
        | "firstName"
        | "lastName"
        | "displayName"
        | "username"
        | "bio"
        | "scheduleTimeZone"
        | "profileVisibility"
        | "locationCity"
        | "locationRegion"
      >
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
    if (input.username !== undefined) {
      data.username = input.username === null ? null : normalizeUsername(input.username);
    }
    if (input.bio !== undefined) {
      data.bio = input.bio;
    }
    if (input.scheduleTimeZone !== undefined) {
      data.scheduleTimeZone = input.scheduleTimeZone;
    }
    if (input.profileVisibility !== undefined) {
      data.profileVisibility = input.profileVisibility;
    }
    if (input.locationCity !== undefined) {
      data.locationCity = input.locationCity;
    }
    if (input.locationRegion !== undefined) {
      data.locationRegion = input.locationRegion;
    }

    try {
      const profile = await this.db.profile.update({
        where: { userId: user.id },
        data,
      });
      return toProfileDto(profile, user, this.kyc, this.db);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        input.username !== undefined &&
        input.username !== null
      ) {
        throw new AppError("CONFLICT", "Username is already taken", 409);
      }
      throw err;
    }
  }
}
