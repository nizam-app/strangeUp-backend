import type { EmailMessage, EmailSender } from "../../src/modules/auth/email-sender.js";

export function createCapturingEmailSender(): EmailSender & {
  lastMessage: EmailMessage | null;
  clear: () => void;
} {
  const state = { lastMessage: null as EmailMessage | null };
  return {
    get lastMessage() {
      return state.lastMessage;
    },
    clear() {
      state.lastMessage = null;
    },
    send(message: EmailMessage): Promise<void> {
      state.lastMessage = message;
      return Promise.resolve();
    },
  };
}

export function extractVerificationTokenFromText(text: string): string | null {
  const match = /verification token \(dev delivery\): (\S+)/.exec(text);
  return match?.[1] ?? null;
}

export function extractPasswordResetTokenFromText(text: string): string | null {
  const direct = /password reset token \(dev delivery\): (\S+)/.exec(text);
  if (direct?.[1]) {
    return direct[1];
  }
  const fromQuery = /[?&]token=([^&\s]+)/.exec(text);
  return fromQuery?.[1] ? decodeURIComponent(fromQuery[1]) : null;
}
