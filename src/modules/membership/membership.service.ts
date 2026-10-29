import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { canAccessAccount, toPolicyActor } from "../policy/account-policy.js";
import { buildSelfMembership } from "./membership-entitlements.js";
import { buildMembershipFlowContract } from "./membership-flow-contract.js";
import { listMembershipPlanOffers } from "./membership-plan-registry.js";
import type { MembershipPlansEnvelopeDto } from "./membership.types.js";

export class MembershipService {
  listPlans(viewer: User) {
    const actor = toPolicyActor(viewer);
    if (!canAccessAccount(actor, viewer.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const envelope: MembershipPlansEnvelopeDto = {
      plans: listMembershipPlanOffers(),
      billingConfigured: false,
      commercialTermsApproved: false,
      flow: buildMembershipFlowContract(),
    };
    return envelope;
  }

  getMyMembership(user: User) {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    return buildSelfMembership(user.id);
  }
}
