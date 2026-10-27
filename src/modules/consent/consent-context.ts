import type { AppEnv } from "../../config/env.js";
import type {
  ConsentEnforcementMode,
  ConsentRegistryContext,
} from "./canonical-consent-registry.js";

export function resolveConsentEnforcementMode(env: AppEnv): ConsentEnforcementMode {
  if (env.CONSENT_ENFORCEMENT === "strict") {
    return "strict";
  }
  if (env.CONSENT_ENFORCEMENT === "placeholder_allowed") {
    return "placeholder_allowed";
  }
  if (env.isProduction) {
    return "strict";
  }
  if (env.NODE_ENV === "test") {
    return "placeholder_allowed";
  }
  return "placeholder_allowed";
}

export function buildConsentRegistryContext(env: AppEnv, now = new Date()): ConsentRegistryContext {
  return {
    enforcementMode: resolveConsentEnforcementMode(env),
    now,
  };
}
