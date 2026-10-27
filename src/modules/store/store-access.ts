import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { hasFullAccountAccess, toPolicyActor } from "../policy/account-policy.js";

export function assertStoreAccess(user: User): void {
  if (!hasFullAccountAccess(toPolicyActor(user))) {
    throw new AppError(
      "AUTH_FORBIDDEN",
      "Store features are not available in the current account state",
      403,
    );
  }
}
