import { describe, expect, it } from "vitest";
import { resolveActivityCancellationCapabilities } from "../../src/modules/admin/admin-activity-cancellation.policy.js";

const actor = "11111111-1111-4111-8111-111111111111";
const host = "22222222-2222-4222-8222-222222222222";
const activityId = "33333333-3333-4333-8333-333333333333";

describe("admin activity cancellation policy", () => {
  it("denies IDENTITY_REVIEWER-only actors", () => {
    const caps = resolveActivityCancellationCapabilities({
      actorUserId: actor,
      actorIsSuperAdmin: false,
      target: { activityId, hostId: host, status: "PUBLISHED" },
    });
    expect(caps.canCancel).toBe(false);
    expect(caps.blockedReason).toBe("NOT_SUPER_ADMIN");
    expect(caps.notificationsSupported).toBe(false);
  });

  it("rejects host self-service through the admin path", () => {
    const caps = resolveActivityCancellationCapabilities({
      actorUserId: host,
      actorIsSuperAdmin: true,
      target: { activityId, hostId: host, status: "PUBLISHED" },
    });
    expect(caps.canCancel).toBe(false);
    expect(caps.blockedReason).toBe("HOST_OWN_ACTIVITY");
  });

  it("allows SUPER_ADMIN cancel of draft and published activities they do not host", () => {
    expect(
      resolveActivityCancellationCapabilities({
        actorUserId: actor,
        actorIsSuperAdmin: true,
        target: { activityId, hostId: host, status: "DRAFT" },
      }).canCancel,
    ).toBe(true);
    expect(
      resolveActivityCancellationCapabilities({
        actorUserId: actor,
        actorIsSuperAdmin: true,
        target: { activityId, hostId: host, status: "PUBLISHED" },
      }).canCancel,
    ).toBe(true);
  });

  it("rejects already cancelled and completed activities", () => {
    expect(
      resolveActivityCancellationCapabilities({
        actorUserId: actor,
        actorIsSuperAdmin: true,
        target: { activityId, hostId: host, status: "CANCELLED" },
      }).blockedReason,
    ).toBe("ALREADY_CANCELLED");
    expect(
      resolveActivityCancellationCapabilities({
        actorUserId: actor,
        actorIsSuperAdmin: true,
        target: { activityId, hostId: host, status: "COMPLETED" },
      }).blockedReason,
    ).toBe("COMPLETED");
  });
});
