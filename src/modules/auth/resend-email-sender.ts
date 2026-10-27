import { Resend } from "resend";
import type { Logger } from "pino";
import { AppError } from "../../common/errors/app-error.js";
import type { EmailMessage, EmailSendResult, EmailSender } from "./email-sender.js";

export type ResendEmailSenderOptions = {
  apiKey: string;
  fromAddress: string;
  logger: Logger;
  requestTimeoutMs?: number;
  maxRetries?: number;
};

type IdempotencyRecord = { stage: EmailSendResult["stage"]; at: number };

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function maskRecipient(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) {
    return "[invalid]";
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

function isPermanentResendError(statusCode: number | undefined): boolean {
  return statusCode !== undefined && statusCode >= 400 && statusCode < 500 && statusCode !== 429;
}

export function createResendEmailSender(options: ResendEmailSenderOptions): EmailSender {
  const resend = new Resend(options.apiKey);
  const timeoutMs = options.requestTimeoutMs ?? 10_000;
  const maxRetries = options.maxRetries ?? 2;
  const idempotencyCache = new Map<string, IdempotencyRecord>();

  const pruneIdempotency = (): void => {
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    for (const [key, record] of idempotencyCache) {
      if (record.at < cutoff) {
        idempotencyCache.delete(key);
      }
    }
  };

  return {
    mode: "provider",
    async send(message: EmailMessage): Promise<EmailSendResult> {
      pruneIdempotency();
      if (message.idempotencyKey) {
        const cached = idempotencyCache.get(message.idempotencyKey);
        if (cached) {
          return { stage: cached.stage, transport: "provider" };
        }
      }

      const html = `<p>${escapeHtml(message.text).replace(/\n/g, "<br/>")}</p>`;
      let attempt = 0;
      let lastError: unknown;

      while (attempt <= maxRetries) {
        attempt += 1;
        try {
          const sendPromise = resend.emails.send({
            from: options.fromAddress,
            to: message.to,
            subject: message.subject,
            text: message.text,
            html,
            headers: message.idempotencyKey
              ? { "Idempotency-Key": message.idempotencyKey }
              : undefined,
          });

          const result = await Promise.race([
            sendPromise,
            new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(new Error("resend request timeout"));
              }, timeoutMs).unref();
            }),
          ]);

          if (result.error) {
            const statusCode =
              "statusCode" in result.error && typeof result.error.statusCode === "number"
                ? result.error.statusCode
                : undefined;
            if (isPermanentResendError(statusCode)) {
              throw new AppError(
                "EMAIL_TRANSPORT_UNAVAILABLE",
                "Transactional email provider rejected the request",
                503,
              );
            }
            if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
              lastError = result.error;
              if (attempt <= maxRetries) {
                await new Promise((r) => setTimeout(r, 200 * attempt));
                continue;
              }
            }
            throw new AppError(
              "EMAIL_TRANSPORT_UNAVAILABLE",
              "Transactional email provider returned an error",
              503,
            );
          }

          const stage = "handed_to_provider" as const;
          if (message.idempotencyKey) {
            idempotencyCache.set(message.idempotencyKey, { stage, at: Date.now() });
          }
          options.logger.info(
            {
              to: maskRecipient(message.to),
              subject: message.subject,
              resendId: result.data?.id ?? null,
            },
            "transactional email handed to Resend (not inbox delivery)",
          );
          return { stage, transport: "provider" };
        } catch (err) {
          lastError = err;
          if (err instanceof AppError) {
            throw err;
          }
          if (attempt <= maxRetries) {
            await new Promise((r) => setTimeout(r, 200 * attempt));
            continue;
          }
        }
      }

      options.logger.warn(
        { to: maskRecipient(message.to), subject: message.subject },
        "transactional email send failed after retries",
      );
      throw new AppError(
        "EMAIL_TRANSPORT_UNAVAILABLE",
        lastError instanceof Error ? lastError.message : "Transactional email send failed",
        503,
        { exposeMessage: false },
      );
    },
  };
}
