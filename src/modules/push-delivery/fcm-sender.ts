import { readFileSync } from "node:fs";
import type { Logger } from "pino";
import type { AppEnv } from "../../config/env.js";
import type { PushDisplayCopy } from "./push-payload.js";

export type FcmSendTarget = {
  deviceTokenId: string;
  registrationToken: string;
};

export type FcmSendOutcome =
  | { outcome: "sent" }
  | { outcome: "invalid_token" }
  | { outcome: "transient_error"; code: string }
  | { outcome: "permanent_error"; code: string }
  | { outcome: "skipped"; reason: string };

export interface FcmSender {
  send(
    message: { data: Record<string, string>; notification: PushDisplayCopy },
    target: FcmSendTarget,
  ): Promise<FcmSendOutcome>;
}

export class DisabledFcmSender implements FcmSender {
  send(): Promise<FcmSendOutcome> {
    return Promise.resolve({ outcome: "skipped", reason: "PUSH_DISABLED" });
  }
}

/** In-memory mock for unit/integration tests — never performs network I/O. */
export class MockFcmSender implements FcmSender {
  readonly sent: { deviceTokenId: string; data: Record<string, string> }[] = [];
  invalidTokenIds = new Set<string>();
  transientOnceForDevice = new Set<string>();

  send(
    message: { data: Record<string, string>; notification: PushDisplayCopy },
    target: FcmSendTarget,
  ): Promise<FcmSendOutcome> {
    if (this.invalidTokenIds.has(target.deviceTokenId)) {
      return Promise.resolve({ outcome: "invalid_token" });
    }
    if (this.transientOnceForDevice.has(target.deviceTokenId)) {
      this.transientOnceForDevice.delete(target.deviceTokenId);
      return Promise.resolve({ outcome: "transient_error", code: "mock_unavailable" });
    }
    this.sent.push({ deviceTokenId: target.deviceTokenId, data: message.data });
    return Promise.resolve({ outcome: "sent" });
  }
}

type FirebaseAdminModule = typeof import("firebase-admin");

async function loadFirebaseAdmin(): Promise<FirebaseAdminModule> {
  return import("firebase-admin");
}

type FirebaseMessaging = ReturnType<FirebaseAdminModule["messaging"]>;

export class FirebaseAdminFcmSender implements FcmSender {
  private readonly messaging: FirebaseMessaging;

  private constructor(messaging: FirebaseMessaging) {
    this.messaging = messaging;
  }

  static async create(env: AppEnv, logger: Logger): Promise<FirebaseAdminFcmSender> {
    const admin = await loadFirebaseAdmin();
    if (admin.apps.length === 0) {
      const credPath = env.FIREBASE_CREDENTIALS_FILE?.trim();
      if (credPath) {
        const serviceAccount = JSON.parse(readFileSync(credPath, "utf8")) as Record<string, unknown>;
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: env.FIREBASE_PROJECT_ID,
        });
      } else if (env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
      } else {
        admin.initializeApp();
      }
      logger.info("Firebase Admin initialized for FCM (credentials path not logged)");
    }
    return new FirebaseAdminFcmSender(admin.messaging());
  }

  async send(
    message: { data: Record<string, string>; notification: PushDisplayCopy },
    target: FcmSendTarget,
  ): Promise<FcmSendOutcome> {
    try {
      await this.messaging.send({
        token: target.registrationToken,
        data: message.data,
        notification: {
          title: message.notification.title,
          body: message.notification.body,
        },
      });
      return { outcome: "sent" };
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err && typeof err.code === "string"
          ? err.code
          : "unknown";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        return { outcome: "invalid_token" };
      }
      if (
        code === "messaging/server-unavailable" ||
        code === "messaging/internal-error" ||
        code === "messaging/quota-exceeded"
      ) {
        return { outcome: "transient_error", code };
      }
      return { outcome: "permanent_error", code };
    }
  }
}

export async function resolveFcmSender(env: AppEnv, logger: Logger): Promise<FcmSender> {
  if (!env.PUSH_ENABLED) {
    return new DisabledFcmSender();
  }
  if (env.NODE_ENV === "test") {
    return new MockFcmSender();
  }
  return FirebaseAdminFcmSender.create(env, logger);
}
