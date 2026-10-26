import type { Logger } from "pino";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Development/test stub — logs redacted destination only; never production delivery. */
export function createDevEmailSender(logger: Logger): EmailSender {
  return {
    send(message: EmailMessage): Promise<void> {
      const [local, domain] = message.to.split("@");
      const masked = domain ? `${local.slice(0, 2)}***@${domain}` : "[invalid]";
      logger.info(
        { to: masked, subject: message.subject, bodyLength: message.text.length },
        "dev email stub (not sent to vendor)",
      );
      return Promise.resolve();
    },
  };
}
