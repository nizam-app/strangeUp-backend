import type {
  EmailMessage,
  EmailSender,
  EmailSendResult,
} from "../../src/modules/auth/email-sender.js";

export function createCapturingEmailSender(): EmailSender & {
  lastMessage: EmailMessage | null;
  clear: () => void;
} {
  const state = { lastMessage: null as EmailMessage | null };
  return {
    mode: "dev_stub",
    get lastMessage() {
      return state.lastMessage;
    },
    clear() {
      state.lastMessage = null;
    },
    send(message: EmailMessage): Promise<EmailSendResult> {
      state.lastMessage = message;
      return Promise.resolve({ stage: "accepted_for_delivery", transport: "test_capture" });
    },
  };
}

export function extractVerificationTokenFromText(text: string): string | null {
  const match = /verification token \(dev delivery\): (\S+)/.exec(text);
  if (match?.[1]) {
    return match[1];
  }
  const fromQuery = /verify-email\?token=([^&\s]+)/.exec(text);
  return fromQuery?.[1] ? decodeURIComponent(fromQuery[1]) : null;
}

export function extractEmailChangeTokenFromText(text: string): string | null {
  const direct = /email change token \(dev delivery\): (\S+)/.exec(text);
  if (direct?.[1]) {
    return direct[1];
  }
  const fromQuery = /confirm-email-change\?token=([^&\s]+)/.exec(text);
  return fromQuery?.[1] ? decodeURIComponent(fromQuery[1]) : null;
}

export function extractPasswordResetTokenFromText(text: string): string | null {
  const direct = /password reset token \(dev delivery\): (\S+)/.exec(text);
  if (direct?.[1]) {
    return direct[1];
  }
  const fromQuery = /[?&]token=([^&\s]+)/.exec(text);
  return fromQuery?.[1] ? decodeURIComponent(fromQuery[1]) : null;
}
