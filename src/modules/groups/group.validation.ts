import { z } from "zod";
import { LOCATION_CITY_MAX, LOCATION_REGION_MAX } from "../me/profile-location.js";
import { GROUP_CATEGORY_SLUGS } from "./group-catalog.js";
import {
  GROUP_CAPACITY_MAX,
  GROUP_CAPACITY_MIN,
  GROUP_COMMENT_BODY_MAX,
  GROUP_DESCRIPTION_MAX,
  GROUP_LIST_MAX_LIMIT,
  GROUP_MESSAGE_BODY_MAX,
  GROUP_NAME_MAX,
  GROUP_POST_BODY_MAX,
  GROUP_SEARCH_Q_MAX,
  GROUP_TAG_MAX,
  GROUP_TAG_MAX_PER_GROUP,
  GROUP_TAG_MIN,
} from "./group.constants.js";
import { isValidGroupTag, normalizeGroupTag } from "./group-policy.js";

const optionalNullableText = (max: number) =>
  z.union([z.string().trim().min(1).max(max), z.null()]).optional();

const groupTagSchema = z
  .string()
  .trim()
  .min(GROUP_TAG_MIN)
  .max(GROUP_TAG_MAX)
  .transform(normalizeGroupTag)
  .refine(isValidGroupTag, "Invalid group tag");

const uniqueTagsSchema = z
  .array(groupTagSchema)
  .max(GROUP_TAG_MAX_PER_GROUP)
  .superRefine((tags, ctx) => {
    if (new Set(tags).size !== tags.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate tags are not allowed" });
    }
  });

export const groupPrivacySchema = z.enum(["PUBLIC", "PRIVATE_APPROVAL"]);
export const groupMeetupFrequencySchema = z.enum(["WEEKLY", "ACTIVE_DAILY", "BIWEEKLY"]);
export const groupMembershipRoleSchema = z.enum(["OWNER", "MODERATOR", "MEMBER"]);

export const groupIdParamSchema = z.object({
  groupId: z.string().uuid(),
});

export const groupMemberIdParamSchema = z.object({
  groupId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const groupUserIdParamSchema = z.object({
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const groupPostIdParamSchema = z.object({
  groupId: z.string().uuid(),
  postId: z.string().uuid(),
});

export const groupCommentIdParamSchema = z.object({
  groupId: z.string().uuid(),
  postId: z.string().uuid(),
  commentId: z.string().uuid(),
});

export const groupActivityIdParamSchema = z.object({
  groupId: z.string().uuid(),
  activityId: z.string().uuid(),
});

export const groupListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(GROUP_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
    q: z.string().trim().min(1).max(GROUP_SEARCH_Q_MAX).optional(),
    category: z.enum(GROUP_CATEGORY_SLUGS).optional(),
    city: z.string().trim().min(1).max(LOCATION_CITY_MAX).optional(),
    region: z.string().trim().min(1).max(LOCATION_REGION_MAX).optional(),
    privacy: groupPrivacySchema.optional(),
    tag: groupTagSchema.optional(),
  })
  .strict();

export const myGroupListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(GROUP_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
    status: z.enum(["ACTIVE", "PENDING"]).optional(),
    role: z.enum(["OWNER", "MODERATOR", "MEMBER"]).optional(),
  })
  .strict();

export const groupCursorListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(GROUP_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export const groupChatListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(GROUP_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
    q: z.string().trim().min(1).max(GROUP_SEARCH_Q_MAX).optional(),
  })
  .strict();

export const createGroupBodySchema = z
  .object({
    name: z.string().trim().min(1).max(GROUP_NAME_MAX),
    description: z.string().trim().max(GROUP_DESCRIPTION_MAX).optional(),
    category: z.enum(GROUP_CATEGORY_SLUGS),
    locationCity: z.string().trim().min(1).max(LOCATION_CITY_MAX).optional(),
    locationRegion: z.string().trim().min(1).max(LOCATION_REGION_MAX).optional(),
    privacy: groupPrivacySchema,
    meetupFrequency: groupMeetupFrequencySchema.optional(),
    memberCapacity: z.number().int().min(GROUP_CAPACITY_MIN).max(GROUP_CAPACITY_MAX).optional(),
    tags: uniqueTagsSchema.optional(),
  })
  .strict();

export const patchGroupBodySchema = z
  .object({
    name: z.string().trim().min(1).max(GROUP_NAME_MAX).optional(),
    description: optionalNullableText(GROUP_DESCRIPTION_MAX),
    category: z.enum(GROUP_CATEGORY_SLUGS).optional(),
    locationCity: optionalNullableText(LOCATION_CITY_MAX),
    locationRegion: optionalNullableText(LOCATION_REGION_MAX),
    privacy: groupPrivacySchema.optional(),
    meetupFrequency: z.union([groupMeetupFrequencySchema, z.null()]).optional(),
    memberCapacity: z
      .union([z.number().int().min(GROUP_CAPACITY_MIN).max(GROUP_CAPACITY_MAX), z.null()])
      .optional(),
    tags: uniqueTagsSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one group field is required",
  });

export const transferOwnershipBodySchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict();

export const changeMemberRoleBodySchema = z
  .object({
    role: z.enum(["MODERATOR", "MEMBER"]),
  })
  .strict();

export const createGroupPostBodySchema = z
  .object({
    body: z.string().trim().min(1).max(GROUP_POST_BODY_MAX),
    activityId: z.string().uuid().optional(),
  })
  .strict();

export const patchGroupPostBodySchema = z
  .object({
    body: z.string().trim().min(1).max(GROUP_POST_BODY_MAX),
  })
  .strict();

export const pinGroupPostBodySchema = z
  .object({
    pinned: z.boolean(),
  })
  .strict();

export const createGroupCommentBodySchema = z
  .object({
    body: z.string().trim().min(1).max(GROUP_COMMENT_BODY_MAX),
  })
  .strict();

export const sendGroupMessageBodySchema = z
  .object({
    body: z.string().trim().min(1).max(GROUP_MESSAGE_BODY_MAX),
    clientMessageId: z.string().uuid().optional(),
  })
  .strict();

export const markGroupChatReadBodySchema = z
  .object({
    messageId: z.string().uuid().optional(),
  })
  .strict();

export const attachGroupActivityBodySchema = z
  .object({
    activityId: z.string().uuid(),
  })
  .strict();

export type CreateGroupInput = z.infer<typeof createGroupBodySchema>;
export type PatchGroupInput = z.infer<typeof patchGroupBodySchema>;
export type GroupListQuery = z.infer<typeof groupListQuerySchema>;
export type MyGroupListQuery = z.infer<typeof myGroupListQuerySchema>;
export type GroupCursorListQuery = z.infer<typeof groupCursorListQuerySchema>;
export type GroupChatListQuery = z.infer<typeof groupChatListQuerySchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipBodySchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleBodySchema>;
export type CreateGroupPostInput = z.infer<typeof createGroupPostBodySchema>;
export type PatchGroupPostInput = z.infer<typeof patchGroupPostBodySchema>;
export type PinGroupPostInput = z.infer<typeof pinGroupPostBodySchema>;
export type CreateGroupCommentInput = z.infer<typeof createGroupCommentBodySchema>;
export type SendGroupMessageInput = z.infer<typeof sendGroupMessageBodySchema>;
export type MarkGroupChatReadInput = z.infer<typeof markGroupChatReadBodySchema>;
export type AttachGroupActivityInput = z.infer<typeof attachGroupActivityBodySchema>;
