import { describe, expect, it } from "vitest";
import { AppError } from "../../src/common/errors/app-error.js";
import {
  compareDashboardEventsNewestFirst,
  decodeDashboardEventsCursor,
  encodeDashboardEventsCursor,
  presentAccountModerationEvent,
  presentActivityModerationEvent,
  presentIdentityReviewEvent,
  sourcesForEventCategory,
  UNSUPPORTED_DASHBOARD_EVENT_FEEDS,
} from "../../src/modules/admin/admin-dashboard-events.js";

describe("admin-dashboard-events", () => {
  it("keeps groups, reports, and transactions unavailable", () => {
    expect(sourcesForEventCategory("all")).toEqual([
      "IDENTITY_REVIEW",
      "ACCOUNT_MODERATION",
      "ACTIVITY_MODERATION",
    ]);
    expect(sourcesForEventCategory("verifications")).toEqual(["IDENTITY_REVIEW"]);
    expect(sourcesForEventCategory("groups")).toBeNull();
    expect(UNSUPPORTED_DASHBOARD_EVENT_FEEDS.transactions.trackerId).toBe("BE-066");
  });

  it("encodes a newest-first cursor that rejects fingerprint mismatch", () => {
    const cursor = encodeDashboardEventsCursor({
      occurredAt: new Date("2026-10-31T12:00:00.000Z"),
      eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      source: "IDENTITY_REVIEW",
      filterFingerprint: "dashboard-events:all",
    });
    const decoded = decodeDashboardEventsCursor(cursor, "dashboard-events:all");
    expect(decoded?.eventId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(() => decodeDashboardEventsCursor(cursor, "dashboard-events:verifications")).toThrow(
      AppError,
    );
  });

  it("orders events by time, then id, then source", () => {
    const a = {
      occurredAt: new Date("2026-10-31T12:00:00.000Z"),
      eventId: "b",
      source: "IDENTITY_REVIEW" as const,
    };
    const b = {
      occurredAt: new Date("2026-10-31T12:00:00.000Z"),
      eventId: "a",
      source: "ACCOUNT_MODERATION" as const,
    };
    expect(compareDashboardEventsNewestFirst(a, b)).toBeLessThan(0);
  });

  it("presents privacy-safe identity and moderation events with real detail hrefs", () => {
    const identity = presentIdentityReviewEvent({
      id: "dec-1",
      userId: "user-1",
      status: "APPROVED",
      createdAt: new Date("2026-10-31T12:00:00.000Z"),
      displayName: "Ada Lovelace",
      hasAvatar: true,
    });
    expect(identity.eventTypeLabel).toBe("Home access approved");
    expect(identity.action?.href).toBe("/verification/user-1");
    expect(JSON.stringify(identity)).not.toContain("@");

    const account = presentAccountModerationEvent({
      id: "dec-2",
      userId: "user-2",
      action: "SUSPEND",
      resultingAccountStatus: "SUSPENDED",
      createdAt: new Date("2026-10-31T12:00:00.000Z"),
      displayName: null,
      hasAvatar: false,
    });
    expect(account.subject.displayName).toBe("Member");
    expect(account.action?.href).toBe("/users/user-2");

    const activity = presentActivityModerationEvent({
      id: "dec-3",
      activityId: "act-1",
      action: "CANCEL",
      createdAt: new Date("2026-10-31T12:00:00.000Z"),
      title: "Sunrise Ride",
    });
    expect(activity.action?.href).toBe("/activities/act-1");
    expect(activity.statusLabel).toBe("Cancelled");
  });
});
