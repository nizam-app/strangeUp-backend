import type { Response } from "express";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { checkRateLimit, throwIfRateLimited } from "../auth/rate-limit.js";
import { createAppMediaStorages } from "../../infrastructure/media-storage/create-media-storages.js";
import { GroupActivityService } from "./group-activity.service.js";
import { GroupChatService } from "./group-chat.service.js";
import { GroupMembershipService } from "./group-membership.service.js";
import { GroupPostService } from "./group-post.service.js";
import { GroupService } from "./group.service.js";
import { GroupPostMediaService } from "../group-content/group-post-media.service.js";
import { GroupStoryService } from "../group-content/group-story.service.js";
import { GroupPollService } from "../group-content/group-poll.service.js";
import { GroupContentReportService } from "../group-content/group-content-report.service.js";
import {
  createContentReportBodySchema,
  createGroupPollBodySchema,
  groupMediaIdParamSchema,
  groupStoryIdParamSchema,
  voteGroupPollBodySchema,
} from "../group-content/group-content.validation.js";
import {
  attachGroupActivityBodySchema,
  changeMemberRoleBodySchema,
  createGroupBodySchema,
  createGroupCommentBodySchema,
  createGroupPostBodySchema,
  groupActivityIdParamSchema,
  groupChatListQuerySchema,
  groupCommentIdParamSchema,
  groupCursorListQuerySchema,
  groupIdParamSchema,
  groupListQuerySchema,
  groupMemberIdParamSchema,
  groupPostIdParamSchema,
  groupUserIdParamSchema,
  markGroupChatReadBodySchema,
  myGroupListQuerySchema,
  patchGroupBodySchema,
  patchGroupPostBodySchema,
  pinGroupPostBodySchema,
  sendGroupMessageBodySchema,
  transferOwnershipBodySchema,
} from "./group.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

async function enforceLimit(key: string, limit: number): Promise<void> {
  throwIfRateLimited(await checkRateLimit(key, limit, 60_000));
}

export function createGroupsControllers(deps: { db: DatabaseClient; env: AppEnv }) {
  const mediaStorages = createAppMediaStorages(deps.env);
  const groupService = new GroupService(deps.db, mediaStorages.groupCover);
  const membershipService = new GroupMembershipService(deps.db);
  const contentStorage = mediaStorages.groupContent;
  const postService = new GroupPostService(deps.db, deps.env);
  const postMediaService = new GroupPostMediaService(deps.db, deps.env, contentStorage);
  const storyService = new GroupStoryService(deps.db, deps.env, contentStorage);
  const pollService = new GroupPollService(deps.db, deps.env);
  const reportService = new GroupContentReportService(deps.db, deps.env);
  const chatService = new GroupChatService(deps.db);
  const activityService = new GroupActivityService(deps.db);

  return {
    listCategories: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await groupService.listCategories(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listDiscoverable: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = groupListQuerySchema.parse(req.query);
      const result = await groupService.listDiscoverable(requireUser(req), query);
      res.status(200).json({
        data: { groups: result.groups },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    getDetail: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await groupService.getDetail(requireUser(req), groupId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getCover: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const { buffer, contentType } = await groupService.getCoverBytes(requireUser(req), groupId);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).send(buffer);
    },

    listMine: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = myGroupListQuerySchema.parse(req.query);
      const result = await groupService.listMine(requireUser(req), query);
      res.status(200).json({
        data: { groups: result.groups },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    create: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      await enforceLimit(`groups:create:${user.id}`, deps.env.GROUP_RATE_LIMIT_CREATE_PER_USER);
      const body = createGroupBodySchema.parse(req.body);
      const data = await groupService.create(user, body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    getManage: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await groupService.getManage(requireUser(req), groupId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    patch: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const body = patchGroupBodySchema.parse(req.body);
      const data = await groupService.patch(requireUser(req), groupId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    uploadCover: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await groupService.uploadCover(requireUser(req), groupId, req.file);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    deleteCover: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await groupService.deleteCover(requireUser(req), groupId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    join: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      await enforceLimit(`groups:join:${user.id}`, deps.env.GROUP_RATE_LIMIT_JOIN_PER_USER);
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await membershipService.join(user, groupId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    leave: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await membershipService.leave(requireUser(req), groupId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listMembers: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const query = groupCursorListQuerySchema.parse(req.query);
      const result = await membershipService.listMembers(requireUser(req), groupId, query);
      res.status(200).json({
        data: { members: result.members },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    listJoinRequests: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const query = groupCursorListQuerySchema.parse(req.query);
      const result = await membershipService.listJoinRequests(requireUser(req), groupId, query);
      res.status(200).json({
        data: { requests: result.requests },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    approve: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, memberId } = groupMemberIdParamSchema.parse(req.params);
      const data = await membershipService.approve(requireUser(req), groupId, memberId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    decline: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, memberId } = groupMemberIdParamSchema.parse(req.params);
      const data = await membershipService.decline(requireUser(req), groupId, memberId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    removeMember: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, userId } = groupUserIdParamSchema.parse(req.params);
      const data = await membershipService.remove(requireUser(req), groupId, userId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    changeRole: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, userId } = groupUserIdParamSchema.parse(req.params);
      const body = changeMemberRoleBodySchema.parse(req.body);
      const data = await membershipService.changeRole(requireUser(req), groupId, userId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    transferOwnership: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const body = transferOwnershipBodySchema.parse(req.body);
      const data = await membershipService.transferOwnership(requireUser(req), groupId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    archive: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await membershipService.archive(requireUser(req), groupId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listPosts: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const query = groupCursorListQuerySchema.parse(req.query);
      const result = await postService.listPosts(requireUser(req), groupId, query);
      res.status(200).json({
        data: { posts: result.posts },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    createPost: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      await enforceLimit(`groups:post:${user.id}`, deps.env.GROUP_RATE_LIMIT_POST_PER_USER);
      const { groupId } = groupIdParamSchema.parse(req.params);
      const body = createGroupPostBodySchema.parse(req.body);
      const data = await postService.createPost(user, groupId, body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    patchPost: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const body = patchGroupPostBodySchema.parse(req.body);
      const data = await postService.patchPost(requireUser(req), groupId, postId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    removePost: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const data = await postService.removePost(requireUser(req), groupId, postId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    pinPost: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const body = pinGroupPostBodySchema.parse(req.body);
      const data = await postService.pinPost(requireUser(req), groupId, postId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listComments: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const query = groupCursorListQuerySchema.parse(req.query);
      const result = await postService.listComments(requireUser(req), groupId, postId, query);
      res.status(200).json({
        data: { comments: result.comments },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    createComment: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      await enforceLimit(`groups:comment:${user.id}`, deps.env.GROUP_RATE_LIMIT_POST_PER_USER);
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const body = createGroupCommentBodySchema.parse(req.body);
      const data = await postService.createComment(user, groupId, postId, body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    removeComment: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId, commentId } = groupCommentIdParamSchema.parse(req.params);
      const data = await postService.removeComment(requireUser(req), groupId, postId, commentId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    like: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const data = await postService.like(requireUser(req), groupId, postId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    unlike: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const data = await postService.unlike(requireUser(req), groupId, postId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listChats: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = groupChatListQuerySchema.parse(req.query);
      const result = await chatService.listChats(requireUser(req), query);
      res.status(200).json({
        data: { chats: result.chats },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    listMessages: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const query = groupCursorListQuerySchema.parse(req.query);
      const result = await chatService.listMessages(requireUser(req), groupId, query);
      res.status(200).json({
        data: { messages: result.messages },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    sendMessage: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      await enforceLimit(`groups:message:${user.id}`, deps.env.GROUP_RATE_LIMIT_MESSAGE_PER_USER);
      const { groupId } = groupIdParamSchema.parse(req.params);
      const body = sendGroupMessageBodySchema.parse(req.body);
      const data = await chatService.sendMessage(user, groupId, body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    markRead: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const body = markGroupChatReadBodySchema.parse(req.body);
      const data = await chatService.markRead(requireUser(req), groupId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listActivities: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const query = groupCursorListQuerySchema.parse(req.query);
      const result = await activityService.list(requireUser(req), groupId, query);
      res.status(200).json({
        data: { activities: result.activities },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    attachActivity: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const body = attachGroupActivityBodySchema.parse(req.body);
      const data = await activityService.attach(requireUser(req), groupId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    detachActivity: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, activityId } = groupActivityIdParamSchema.parse(req.params);
      const data = await activityService.detach(requireUser(req), groupId, activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    attachPostMedia: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      await enforceLimit(`groups:media:${user.id}`, deps.env.GROUP_RATE_LIMIT_MEDIA_PER_USER);
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const data = await postMediaService.attachPhoto(user, groupId, postId, req.file);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    getPostMedia: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId, mediaId } = groupMediaIdParamSchema.parse(req.params);
      const { buffer, contentType } = await postMediaService.getPhotoBytes(
        requireUser(req),
        groupId,
        postId,
        mediaId,
      );
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).send(buffer);
    },

    removePostMedia: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId, mediaId } = groupMediaIdParamSchema.parse(req.params);
      const data = await postMediaService.removePhoto(requireUser(req), groupId, postId, mediaId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listStories: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await storyService.listStories(requireUser(req), groupId);
      res.status(200).json({ data: { stories: data }, meta: { requestId: req.requestId } });
    },

    createStory: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      await enforceLimit(`groups:story:${user.id}`, deps.env.GROUP_RATE_LIMIT_STORY_PER_USER);
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await storyService.createStory(user, groupId, req.file);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    getStoryMedia: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, storyId } = groupStoryIdParamSchema.parse(req.params);
      const { buffer, contentType } = await storyService.getStoryMediaBytes(
        requireUser(req),
        groupId,
        storyId,
      );
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).send(buffer);
    },

    removeStory: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, storyId } = groupStoryIdParamSchema.parse(req.params);
      const data = await storyService.removeStory(requireUser(req), groupId, storyId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    createPoll: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const body = createGroupPollBodySchema.parse(req.body);
      const data = await pollService.createPoll(requireUser(req), groupId, postId, body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    getPoll: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const data = await pollService.getPoll(requireUser(req), groupId, postId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    votePoll: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId, postId } = groupPostIdParamSchema.parse(req.params);
      const body = voteGroupPollBodySchema.parse(req.body);
      const data = await pollService.vote(requireUser(req), groupId, postId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    createContentReport: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      await enforceLimit(`groups:report:${user.id}`, deps.env.GROUP_RATE_LIMIT_REPORT_PER_USER);
      const { groupId } = groupIdParamSchema.parse(req.params);
      const body = createContentReportBodySchema.parse(req.body);
      const data = await reportService.createReport(user, groupId, body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    listContentReports: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { groupId } = groupIdParamSchema.parse(req.params);
      const data = await reportService.listOpenForModerators(requireUser(req), groupId);
      res.status(200).json({ data: { reports: data }, meta: { requestId: req.requestId } });
    },
  };
}
