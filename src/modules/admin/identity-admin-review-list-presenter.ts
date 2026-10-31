export type PendingReviewStage = "MANUAL_IDENTITY" | "PLATFORM_ACTIVATION";

export type IdentityReviewListSessionSnapshot = {
  provider: string;
  status: string;
  completedAt: Date | null;
  updatedAt: Date;
};

export function resolveIdentityReviewListPresentation(input: {
  adminReviewStatus: string;
  session: IdentityReviewListSessionSnapshot | null;
}): {
  pendingReviewStage: PendingReviewStage | null;
  pendingReviewLabel: string | null;
  submittedAt: Date | null;
} {
  if (
    input.adminReviewStatus === "NOT_READY" &&
    input.session?.provider === "MANUAL" &&
    input.session.status === "IN_REVIEW"
  ) {
    return {
      pendingReviewStage: "MANUAL_IDENTITY",
      pendingReviewLabel: "Identity Review Required",
      submittedAt: input.session.updatedAt,
    };
  }

  if (
    input.session &&
    (input.adminReviewStatus === "PENDING" || input.adminReviewStatus === "NEEDS_FURTHER_REVIEW")
  ) {
    return {
      pendingReviewStage: "PLATFORM_ACTIVATION",
      pendingReviewLabel: "Platform / Home access",
      submittedAt: input.session.completedAt,
    };
  }

  return {
    pendingReviewStage: null,
    pendingReviewLabel: null,
    submittedAt: input.session?.completedAt ?? null,
  };
}
