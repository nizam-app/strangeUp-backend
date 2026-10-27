export type FeatureAvailability = "LIVE" | "DEV_ONLY" | "DEFERRED" | "UNAVAILABLE";

export type SettingsCapabilitiesDto = {
  emailChange: FeatureAvailability;
  sessionInventory: FeatureAvailability;
  perSessionRevocation: FeatureAvailability;
  accountDeletion: FeatureAvailability;
  twoFactorAuth: FeatureAvailability;
  membershipPlanCatalog: FeatureAvailability;
  subscription: FeatureAvailability;
  paymentHistory: FeatureAvailability;
  phoneVerification: FeatureAvailability;
  identityVerification: FeatureAvailability;
  support247: FeatureAvailability;
  meetupInvites: FeatureAvailability;
  hostRatings: FeatureAvailability;
};

export function buildSettingsCapabilities(): SettingsCapabilitiesDto {
  return {
    emailChange: "DEV_ONLY",
    sessionInventory: "LIVE",
    perSessionRevocation: "LIVE",
    accountDeletion: "UNAVAILABLE",
    twoFactorAuth: "DEFERRED",
    membershipPlanCatalog: "LIVE",
    subscription: "DEFERRED",
    paymentHistory: "DEFERRED",
    phoneVerification: "DEFERRED",
    identityVerification: "LIVE",
    support247: "DEFERRED",
    meetupInvites: "DEFERRED",
    hostRatings: "DEFERRED",
  };
}
