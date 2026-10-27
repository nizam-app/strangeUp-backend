import type { AppEnv } from "../../config/env.js";
import { LocalActivityCoverStorage } from "../../modules/activities/activity-cover.storage.js";
import type { ActivityCoverStorage } from "../../modules/activities/activity-cover.storage.js";
import { LocalGroupContentStorage } from "../../modules/group-content/group-content.storage.js";
import type { GroupContentStorage } from "../../modules/group-content/group-content.storage.js";
import { LocalGroupCoverStorage } from "../../modules/groups/group-cover.storage.js";
import type { GroupCoverStorage } from "../../modules/groups/group-cover.storage.js";
import { LocalAvatarStorage } from "../../modules/profile-media/local-avatar-storage.js";
import type { AvatarStorage } from "../../modules/profile-media/local-avatar-storage.js";
import { S3ActivityCoverStorage } from "../../modules/activities/s3-activity-cover.storage.js";
import { S3AvatarStorage } from "../../modules/profile-media/s3-avatar.storage.js";
import { S3GroupContentStorage } from "../../modules/group-content/s3-group-content.storage.js";
import { S3GroupCoverStorage } from "../../modules/groups/s3-group-cover.storage.js";
import type { MediaStorageNamespace } from "./media-object-store.types.js";
import { S3MediaObjectStore } from "./s3-media-object-store.js";
import { getSharedS3Client, resolveS3MediaConfig } from "./s3-config.js";

export type AppMediaStorages = {
  avatar: AvatarStorage;
  activityCover: ActivityCoverStorage;
  groupCover: GroupCoverStorage;
  groupContent: GroupContentStorage;
};

function createS3Store(env: AppEnv, namespace: MediaStorageNamespace): S3MediaObjectStore {
  const config = resolveS3MediaConfig(env);
  return new S3MediaObjectStore({
    client: getSharedS3Client(env),
    bucket: config.bucket,
    namespace,
    keyPrefix: config.keyPrefix,
    requestTimeoutMs: config.requestTimeoutMs,
    maxRetries: config.maxRetries,
  });
}

export function createAppMediaStorages(env: AppEnv): AppMediaStorages {
  if (env.MEDIA_STORAGE_BACKEND === "s3") {
    return {
      avatar: new S3AvatarStorage(createS3Store(env, "profile")),
      activityCover: new S3ActivityCoverStorage(createS3Store(env, "activity-cover")),
      groupCover: new S3GroupCoverStorage(createS3Store(env, "group-cover")),
      groupContent: new S3GroupContentStorage(createS3Store(env, "group-content")),
    };
  }

  return {
    avatar: new LocalAvatarStorage(env.PROFILE_UPLOAD_DIR),
    activityCover: new LocalActivityCoverStorage(env.ACTIVITY_UPLOAD_DIR),
    groupCover: new LocalGroupCoverStorage(env.GROUP_UPLOAD_DIR),
    groupContent: new LocalGroupContentStorage(env.GROUP_UPLOAD_DIR),
  };
}
