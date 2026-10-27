import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { canAccessAccount, toPolicyActor } from "../policy/account-policy.js";
import { buildSelfMembership } from "./membership-entitlements.js";
import { listMembershipPlanOffers } from "./membership-plan-registry.js";

export class MembershipService {
  listPlans(viewer: User) {
    const actor = toPolicyActor(viewer);
    if (!canAccessAccount(actor, viewer.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    return {
      plans: listMembershipPlanOffers(),
      billingConfigured: false,
      commercialTermsApproved: false,
    };
  }

  getMyMembership(user: User) {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    return buildSelfMembership(user.id);
  }
}
