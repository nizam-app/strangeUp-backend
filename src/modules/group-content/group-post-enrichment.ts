import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { GroupPostDto } from "../groups/group.dto.js";
import { GroupPollService } from "./group-poll.service.js";
import { GroupPostMediaService } from "./group-post-media.service.js";
import { createAppMediaStorages } from "../../infrastructure/media-storage/create-media-storages.js";

export async function enrichGroupPostDto(
  db: DatabaseClient,
  env: AppEnv,
  viewerId: string,
  dto: GroupPostDto,
): Promise<GroupPostDto> {
  if (!env.GROUP_COMMUNITY_INTERACTIVE_ENABLED) {
    return { ...dto, photo: null, poll: null };
  }
  const storage = createAppMediaStorages(env).groupContent;
  const postMedia = new GroupPostMediaService(db, env, storage);
  const pollService = new GroupPollService(db, env);
  const [photo, poll] = await Promise.all([
    postMedia.loadActivePhotoForPost(dto.groupId, dto.postId),
    pollService.loadPollForPostIfEnabled(viewerId, dto.groupId, dto.postId),
  ]);
  return { ...dto, photo, poll };
}

export function baseGroupPostFields(): Pick<GroupPostDto, "photo" | "poll"> {
  return { photo: null, poll: null };
}
