import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";

export function isGroupCommunityInteractiveEnabled(env: AppEnv): boolean {
  return env.GROUP_COMMUNITY_INTERACTIVE_ENABLED;
}

/** D-06 gate: routes exist but fail closed until owner approves interactive community media. */
export function assertGroupCommunityInteractiveEnabled(env: AppEnv): void {
  if (!isGroupCommunityInteractiveEnabled(env)) {
    throw new AppError(
      "FEATURE_DISABLED",
      "Group stories, photo posts, and polls are not enabled pending owner policy approval (D-06)",
      403,
    );
  }
}

export function postMediaContentPath(groupId: string, postId: string, mediaId: string): string {
  return `/v1/groups/${groupId}/posts/${postId}/media/${mediaId}`;
}

export function storyMediaContentPath(groupId: string, storyId: string): string {
  return `/v1/groups/${groupId}/stories/${storyId}/media`;
}

export function isStoryExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function computeStoryExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
}
