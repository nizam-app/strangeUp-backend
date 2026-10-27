export type GroupPostPhotoDto = {
  mediaId: string;
  contentPath: string;
};

export type GroupPollOptionResultDto = {
  optionId: string;
  label: string;
  voteCount: number;
};

export type GroupPollDto = {
  pollId: string;
  postId: string;
  groupId: string;
  closesAt: string;
  closed: boolean;
  totalVotes: number;
  options: GroupPollOptionResultDto[];
  myVoteOptionId: string | null;
};

export type GroupStorySummaryDto = {
  storyId: string;
  groupId: string;
  authorUserId: string;
  contentPath: string;
  createdAt: string;
  expiresAt: string;
};

export type GroupContentReportDto = {
  reportId: string;
  groupId: string;
  targetType: "POST" | "STORY" | "POST_MEDIA";
  targetId: string;
  reason: "SPAM" | "HARASSMENT" | "INAPPROPRIATE_MEDIA" | "OTHER";
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
};
