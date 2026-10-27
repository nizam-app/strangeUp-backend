import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { canAccessAccount, toPolicyActor } from "../policy/account-policy.js";

export type AccountDeletionImpactDto = {
  deletion: {
    status: "AWAITING_POLICY";
    destructiveEndpointAvailable: false;
    message: string;
  };
  dependencyCounts: {
    hostedActivities: number;
    activityParticipations: number;
    ownedCommunityGroups: number;
    activeCommunityMemberships: number;
    communityPostsAuthored: number;
    communityPostCommentsAuthored: number;
    directMessagesAuthored: number;
    communityGroupMessagesAuthored: number;
    storeCartItems: number;
    jobListingsAuthored: number;
    jobApplicationsSubmitted: number;
    savedJobs: number;
    savedActivities: number;
    usersBlocked: number;
    activeSessions: number;
    notificationsReceived: number;
  };
};

export class AccountDeletionImpactService {
  constructor(private readonly db: DatabaseClient) {}

  async getImpact(user: User): Promise<AccountDeletionImpactDto> {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const userId = user.id;
    const now = new Date();

    const [
      hostedActivities,
      activityParticipations,
      ownedCommunityGroups,
      activeCommunityMemberships,
      communityPostsAuthored,
      communityPostCommentsAuthored,
      directMessagesAuthored,
      communityGroupMessagesAuthored,
      storeCartItems,
      jobListingsAuthored,
      jobApplicationsSubmitted,
      savedJobs,
      savedActivities,
      usersBlocked,
      activeSessions,
      notificationsReceived,
    ] = await Promise.all([
      this.db.activity.count({ where: { hostId: userId } }),
      this.db.activityParticipation.count({
        where: { userId, state: { not: "CANCELLED" } },
      }),
      this.db.communityGroup.count({ where: { ownerId: userId } }),
      this.db.communityMembership.count({
        where: { userId, status: "ACTIVE" },
      }),
      this.db.communityPost.count({ where: { authorId: userId } }),
      this.db.communityPostComment.count({ where: { authorId: userId } }),
      this.db.directMessage.count({ where: { authorId: userId } }),
      this.db.communityGroupMessage.count({ where: { authorId: userId } }),
      this.db.storeCartItem.count({ where: { userId } }),
      this.db.jobListing.count({ where: { authorUserId: userId } }),
      this.db.jobApplication.count({ where: { applicantUserId: userId } }),
      this.db.savedJob.count({ where: { userId } }),
      this.db.savedActivity.count({ where: { userId } }),
      this.db.userBlock.count({ where: { blockerId: userId } }),
      this.db.session.count({
        where: { userId, revokedAt: null, expiresAt: { gt: now } },
      }),
      this.db.userNotification.count({ where: { recipientId: userId } }),
    ]);

    return {
      deletion: {
        status: "AWAITING_POLICY",
        destructiveEndpointAvailable: false,
        message:
          "Account deletion is not available. Owner-approved retention, cooling-off, and third-party content policy is required before any destructive delete endpoint.",
      },
      dependencyCounts: {
        hostedActivities,
        activityParticipations,
        ownedCommunityGroups,
        activeCommunityMemberships,
        communityPostsAuthored,
        communityPostCommentsAuthored,
        directMessagesAuthored,
        communityGroupMessagesAuthored,
        storeCartItems,
        jobListingsAuthored,
        jobApplicationsSubmitted,
        savedJobs,
        savedActivities,
        usersBlocked,
        activeSessions,
        notificationsReceived,
      },
    };
  }
}
