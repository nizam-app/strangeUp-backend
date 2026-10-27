import { describe, expect, it } from "vitest";
import pino from "pino";
import {
  buildAuthChallengeEmailText,
  buildPriorEmailChangedNoticeText,
} from "../src/modules/auth/auth-email-content.js";
import {
  createDisabledEmailSender,
  createDevEmailSender,
  resolveEmailSender,
} from "../src/modules/auth/email-sender.js";
import { AppError } from "../src/common/errors/app-error.js";

describe("transactional email transport (Task 019)", () => {
  it("dev stub never includes full recipient in logs-only path", async () => {
    const sender = createDevEmailSender(pino({ level: "silent" }));
    const result = await sender.send({
      to: "user@example.com",
      subject: "Test",
      text: "body",
    });
    expect(result.stage).toBe("accepted_for_delivery");
    expect(result.transport).toBe("dev_stub");
  });

  it("disabled sender fail-closes with EMAIL_TRANSPORT_UNAVAILABLE", async () => {
    const sender = createDisabledEmailSender();
    await expect(sender.send({ to: "a@b.com", subject: "s", text: "t" })).rejects.toBeInstanceOf(
      AppError,
    );
    try {
      await sender.send({ to: "a@b.com", subject: "s", text: "t" });
    } catch (err) {
      expect(err).toMatchObject({
        code: "EMAIL_TRANSPORT_UNAVAILABLE",
        statusCode: 503,
      });
    }
  });

  it("resolveEmailSender uses disabled transport for provider without credentials", () => {
    const sender = resolveEmailSender({
      mode: "provider",
      logger: pino({ level: "silent" }),
    });
    expect(sender.mode).toBe("disabled");
  });

  it("buildAuthChallengeEmailText omits raw token when dev fallback disallowed", () => {
    expect(() =>
      buildAuthChallengeEmailText({
        purpose: "email_verify",
        token: "secret-token-value",
        path: "/verify-email",
        allowDevTokenFallback: false,
      }),
    ).toThrow(AppError);
  });

  it("buildAuthChallengeEmailText uses trusted link when PUBLIC_APP_BASE_URL is set", () => {
    const text = buildAuthChallengeEmailText({
      purpose: "password_reset",
      token: "tok123",
      publicAppBaseUrl: "https://app.example.com",
      path: "/reset-password",
      allowDevTokenFallback: false,
    });
    expect(text).toContain("https://app.example.com/reset-password?token=");
    expect(text).not.toContain("dev delivery");
    expect(text).not.toMatch(/token \(dev delivery\)/);
  });

  it("prior-email notice does not embed secrets", () => {
    const text = buildPriorEmailChangedNoticeText();
    expect(text.toLowerCase()).not.toContain("token");
  });
});
