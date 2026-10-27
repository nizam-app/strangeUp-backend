import { describe, expect, it, vi, beforeEach } from "vitest";
import pino from "pino";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: sendMock };
    constructor(_apiKey: string) {}
  },
}));

describe("Resend email sender (Task 019B)", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("returns handed_to_provider when Resend accepts the message", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
    const { createResendEmailSender } = await import("../src/modules/auth/resend-email-sender.js");
    const sender = createResendEmailSender({
      apiKey: "re_test_key",
      fromAddress: "noreply@example.com",
      logger: pino({ level: "silent" }),
      requestTimeoutMs: 5_000,
      maxRetries: 0,
    });

    const result = await sender.send({
      to: "user@example.com",
      subject: "Verify",
      text: "https://app.example.com/verify-email?token=abc",
      idempotencyKey: "auth:email-verify:ch1",
    });

    expect(result.stage).toBe("handed_to_provider");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates by idempotency key without a second vendor call", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
    const { createResendEmailSender } = await import("../src/modules/auth/resend-email-sender.js");
    const sender = createResendEmailSender({
      apiKey: "re_test_key",
      fromAddress: "noreply@example.com",
      logger: pino({ level: "silent" }),
      maxRetries: 0,
    });

    const message = {
      to: "user@example.com",
      subject: "Verify",
      text: "link",
      idempotencyKey: "auth:email-verify:ch-dup",
    };
    await sender.send(message);
    await sender.send(message);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("fail-closes on permanent provider rejection", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { statusCode: 403, message: "invalid api key" },
    });
    const { createResendEmailSender } = await import("../src/modules/auth/resend-email-sender.js");
    const sender = createResendEmailSender({
      apiKey: "re_bad",
      fromAddress: "noreply@example.com",
      logger: pino({ level: "silent" }),
      maxRetries: 0,
    });

    await expect(
      sender.send({ to: "user@example.com", subject: "s", text: "t" }),
    ).rejects.toMatchObject({ code: "EMAIL_TRANSPORT_UNAVAILABLE" });
  });
});
