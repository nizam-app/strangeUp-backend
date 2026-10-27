/**
 * Manual DEV/ops helper: purge expired story metadata and best-effort filesystem blobs.
 * Not scheduled — invoke explicitly. Defaults to dry-run unless --apply is passed.
 *
 * Usage:
 *   npx tsx scripts/cleanup-group-expired-content.ts [--apply]
 */
import "dotenv/config";
import { loadEnv } from "../src/config/env.js";
import { createPrismaClient, disconnectPrisma } from "../src/infrastructure/database/prisma.js";
import { createAppMediaStorages } from "../src/infrastructure/media-storage/create-media-storages.js";

const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  const env = loadEnv(process.env);
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (env.isProduction) {
    throw new Error("Refusing to run cleanup in production without explicit non-default tooling");
  }

  const db = createPrismaClient(env.DATABASE_URL);
  const storage = createAppMediaStorages(env).groupContent;
  const now = new Date();

  const expiredStories = await db.communityGroupStory.findMany({
    where: { expiresAt: { lte: now }, moderation: "VISIBLE" },
    include: { media: true },
    take: 500,
  });

  console.log(
    `[cleanup-group-expired-content] ${expiredStories.length} expired visible stories (dryRun=${!apply})`,
  );

  for (const story of expiredStories) {
    console.log(
      `  story ${story.id} group=${story.groupId} expired=${story.expiresAt.toISOString()}`,
    );
    if (!apply) {
      continue;
    }
    await db.$transaction([
      db.communityGroupStory.update({
        where: { id: story.id },
        data: { moderation: "REMOVED", removedAt: now },
      }),
      db.communityGroupMedia.update({
        where: { id: story.mediaId },
        data: { lifecycle: "REMOVED", removedAt: now },
      }),
    ]);
    await storage.deleteByStorageKey(story.media.storageKey, story.groupId).catch(() => undefined);
  }

  await disconnectPrisma();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
