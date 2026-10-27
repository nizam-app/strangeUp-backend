import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { canAccessAccount, toPolicyActor } from "../policy/account-policy.js";

export type SecuritySessionDto = {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
  hasUserAgent: boolean;
};

export class SecuritySessionsService {
  constructor(private readonly db: DatabaseClient) {}

  async listSessions(user: User, currentSessionId: string | undefined) {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const now = new Date();
    const rows = await this.db.session.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        userAgent: true,
      },
    });

    const sessions: SecuritySessionDto[] = rows.map((row) => ({
      sessionId: row.id,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      isCurrent: currentSessionId !== undefined && row.id === currentSessionId,
      hasUserAgent: row.userAgent !== null && row.userAgent.length > 0,
    }));

    return { sessions };
  }

  async revokeSession(user: User, sessionId: string, currentSessionId: string | undefined) {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const session = await this.db.session.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { id: true, revokedAt: true },
    });

    if (!session || session.revokedAt) {
      return {
        sessionId,
        revoked: false,
        wasCurrentSession: false,
      };
    }

    await this.db.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return {
      sessionId,
      revoked: true,
      wasCurrentSession: currentSessionId !== undefined && sessionId === currentSessionId,
    };
  }
}
