import { z } from "zod";
import {
  GROUP_CONTENT_REPORT_DETAIL_MAX_LENGTH,
  GROUP_POLL_MAX_OPTION_LABEL_LENGTH,
  GROUP_POLL_MAX_OPTIONS,
  GROUP_POLL_MIN_OPTIONS,
} from "./group-content.constants.js";

export const groupMediaIdParamSchema = z.object({
  groupId: z.string().uuid(),
  postId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

export const groupStoryIdParamSchema = z.object({
  groupId: z.string().uuid(),
  storyId: z.string().uuid(),
});

export const createGroupPollBodySchema = z.object({
  closesAt: z.string().datetime(),
  options: z
    .array(z.string().trim().min(1).max(GROUP_POLL_MAX_OPTION_LABEL_LENGTH))
    .min(GROUP_POLL_MIN_OPTIONS)
    .max(GROUP_POLL_MAX_OPTIONS)
    .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === opts.length, {
      message: "Poll options must be distinct",
    }),
});

export const voteGroupPollBodySchema = z.object({
  optionId: z.string().uuid(),
});

export const createContentReportBodySchema = z.object({
  targetType: z.enum(["POST", "STORY", "POST_MEDIA"]),
  targetId: z.string().uuid(),
  reason: z.enum(["SPAM", "HARASSMENT", "INAPPROPRIATE_MEDIA", "OTHER"]),
  detail: z.string().trim().max(GROUP_CONTENT_REPORT_DETAIL_MAX_LENGTH).optional(),
});

export type CreateGroupPollBody = z.infer<typeof createGroupPollBodySchema>;
export type VoteGroupPollBody = z.infer<typeof voteGroupPollBodySchema>;
export type CreateContentReportBody = z.infer<typeof createContentReportBodySchema>;
