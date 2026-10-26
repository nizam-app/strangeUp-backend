import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client.js";

export type DatabaseClient = PrismaClient;

export function createPrismaClient(databaseUrl: string): DatabaseClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

let sharedClient: DatabaseClient | undefined;

export function getPrismaClient(databaseUrl: string): DatabaseClient {
  if (!sharedClient) {
    sharedClient = createPrismaClient(databaseUrl);
  }
  return sharedClient;
}

export async function disconnectPrisma(): Promise<void> {
  if (sharedClient) {
    await sharedClient.$disconnect();
    sharedClient = undefined;
  }
}

export async function checkDatabaseConnectivity(client: DatabaseClient): Promise<void> {
  await client.$queryRaw`SELECT 1`;
}
