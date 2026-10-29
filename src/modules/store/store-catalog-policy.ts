import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";

export function isStoreCatalogManagementEnabled(env: AppEnv): boolean {
  return env.STORE_CATALOG_MANAGEMENT_ENABLED;
}

export function assertStoreCatalogManagementEnabled(env: AppEnv): void {
  if (!isStoreCatalogManagementEnabled(env)) {
    throw new AppError(
      "FEATURE_DISABLED",
      "Store catalog management is not enabled pending owner approval (MKT-01/02)",
      403,
    );
  }
}
