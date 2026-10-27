import { describe, expect, it, vi } from "vitest";
import { AppError } from "../src/common/errors/app-error.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import type { DatabaseClient } from "../src/infrastructure/database/prisma.js";
import type { EmailSender } from "../src/modules/auth/email-sender.js";
import { buildTestEnv } from "./helpers/test-app.js";

function createMockDb(overrides: {
  user?: {
    id: string;
    email: string;
    emailNormalized: string;
    passwordCredential: { passwordHash: string };
    deletedAt: null;
    suspendedAt: null;
    accountStatus: "ACTIVE";
  };
}): DatabaseClient {
  const challenges: Array<{ userId: string; type: string }> = [];
  return {
    user: {
      findUnique: vi.fn(() => Promise.resolve(overrides.user ?? null)),
    },
    authChallenge: {
      deleteMany: vi.fn(({ where }: { where: { userId?: string; type?: string } }) => {
        const before = challenges.length;
        for (let i = challenges.length - 1; i >= 0; i -= 1) {
          const row = challenges[i];
          if (
            (where.userId === undefined || row.userId === where.userId) &&
            (where.type === undefined || row.type === where.type)
          ) {
            challenges.splice(i, 1);
          }
        }
        return Promise.resolve({ count: before - challenges.length });
      }),
      create: vi.fn(({ data }: { data: { userId: string; type: string } }) => {
        challenges.push({ userId: data.userId, type: data.type });
        return Promise.resolve({ id: "c1" });
      }),
    },
  } as unknown as DatabaseClient;
}

describe("auth email challenge lifecycle (Task 019)", () => {
  it("rolls back PASSWORD_RESET challenge when email transport is unavailable", async () => {
    const user = {
      id: "u1",
      email: "user@example.com",
      emailNormalized: "user@example.com",
      passwordCredential: { passwordHash: "hash" },
      deletedAt: null,
      suspendedAt: null,
      accountStatus: "ACTIVE" as const,
    };
    const db = createMockDb({ user });
    const emailSender: EmailSender = {
      mode: "disabled",
      send: vi.fn(() => {
        return Promise.reject(new AppError("EMAIL_TRANSPORT_UNAVAILABLE", "not configured", 503));
      }),
    };
    const auth = new AuthService(
      db,
      {
        ...buildTestEnv().auth,
        PUBLIC_APP_BASE_URL: "https://app.example.com",
      },
      emailSender,
    );
    await auth.requestPasswordReset("user@example.com");
    expect(db.authChallenge.deleteMany).toHaveBeenCalled();
    expect(db.authChallenge.create).toHaveBeenCalled();
  });
});
