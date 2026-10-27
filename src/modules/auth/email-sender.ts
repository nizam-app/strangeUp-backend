import type { Logger } from "pino";
import { AppError } from "../../common/errors/app-error.js";
import { createResendEmailSender } from "./resend-email-sender.js";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  /** Stable per-challenge key for bounded retries without duplicate sends. */
  idempotencyKey?: string;
};

/** Accepted by API vs handed to provider vs confirmed delivery — we never claim inbox delivery here. */
export type EmailSendStage = "not_sent" | "accepted_for_delivery" | "handed_to_provider";

export type EmailSendResult = {
  stage: EmailSendStage;
  transport: "dev_stub" | "test_capture" | "disabled" | "provider";
};

export type TransactionalEmailMode = "dev_stub" | "disabled" | "provider";

export interface EmailSender {
  readonly mode: TransactionalEmailMode;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Development/test stub — logs redacted destination only; never production delivery. */
export function createDevEmailSender(logger: Logger): EmailSender {
  return {
    mode: "dev_stub",
    send(message: EmailMessage): Promise<EmailSendResult> {
      const [local, domain] = message.to.split("@");
      const masked = domain ? `${local.slice(0, 2)}***@${domain}` : "[invalid]";
      logger.info(
        { to: masked, subject: message.subject, bodyLength: message.text.length },
        "dev email stub (not sent to vendor)",
      );
      return Promise.resolve({ stage: "accepted_for_delivery", transport: "dev_stub" });
    },
  };
}

/** Production fail-closed transport when no approved provider is configured. */
export function createDisabledEmailSender(): EmailSender {
  return {
    mode: "disabled",
    send(): Promise<EmailSendResult> {
      return Promise.reject(
        new AppError(
          "EMAIL_TRANSPORT_UNAVAILABLE",
          "Transactional email is not configured for this environment",
          503,
        ),
      );
    },
  };
}

export function resolveEmailSender(options: {
  mode: TransactionalEmailMode;
  logger: Logger;
  fromAddress?: string;
  resendApiKey?: string;
  requestTimeoutMs?: number;
  maxRetries?: number;
}): EmailSender {
  switch (options.mode) {
    case "dev_stub":
      return createDevEmailSender(options.logger);
    case "disabled":
      return createDisabledEmailSender();
    case "provider": {
      const apiKey = options.resendApiKey?.trim();
      const fromAddress = options.fromAddress?.trim();
      if (!apiKey || !fromAddress) {
        return createDisabledEmailSender();
      }
      return createResendEmailSender({
        apiKey,
        fromAddress,
        logger: options.logger,
        requestTimeoutMs: options.requestTimeoutMs,
        maxRetries: options.maxRetries,
      });
    }
    default: {
      const _exhaustive: never = options.mode;
      return _exhaustive;
    }
  }
}
