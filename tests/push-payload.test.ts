import { describe, expect, it } from "vitest";
import { buildPrivacySafePushPayload } from "../src/modules/push-delivery/push-payload.js";

describe("push-payload (Task 023D)", () => {
  it("uses generic copy and omits private notification body", () => {
    const built = buildPrivacySafePushPayload({
      notificationId: "11111111-1111-4111-8111-111111111111",
      type: "DIRECT_MESSAGE_RECEIVED",
      sourceId: "22222222-2222-4222-8222-222222222222",
    });
    expect(built.notification.title).toBe("New message");
    expect(built.notification.body).not.toMatch(/secret/i);
    expect(built.data.notificationId).toBe("11111111-1111-4111-8111-111111111111");
    expect(built.data.type).toBe("DIRECT_MESSAGE_RECEIVED");
    expect(built.data.sourceId).toBe("22222222-2222-4222-8222-222222222222");
    expect(JSON.stringify(built)).not.toContain("registrationToken");
  });
});
