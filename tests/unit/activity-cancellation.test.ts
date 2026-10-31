import { describe, expect, it, vi } from "vitest";
import {
  ACTIVITY_ADMIN_CANCELLABLE_STATUSES,
  ACTIVITY_PARTICIPATION_STATES_CLOSED_ON_CANCEL,
  applyActivityCancellationRecords,
  isAdminCancellableActivityStatus,
} from "../../src/modules/activities/activity-cancellation.js";

describe("activity cancellation records", () => {
  it("treats only draft and published as admin-cancellable", () => {
    expect(ACTIVITY_ADMIN_CANCELLABLE_STATUSES).toEqual(["DRAFT", "PUBLISHED"]);
    expect(isAdminCancellableActivityStatus("DRAFT")).toBe(true);
    expect(isAdminCancellableActivityStatus("PUBLISHED")).toBe(true);
    expect(isAdminCancellableActivityStatus("CANCELLED")).toBe(false);
    expect(isAdminCancellableActivityStatus("COMPLETED")).toBe(false);
  });

  it("closes open participation states without deleting rows", async () => {
    const now = new Date("2026-10-31T12:00:00.000Z");
    const activityUpdate = vi.fn();
    const participationUpdate = vi.fn();
    const executeRaw = vi.fn();
    await applyActivityCancellationRecords(
      {
        $executeRaw: executeRaw,
        activity: { update: activityUpdate },
        activityParticipation: { updateMany: participationUpdate },
      },
      { activityId: "33333333-3333-4333-8333-333333333333", now },
    );

    expect(activityUpdate).toHaveBeenCalledWith({
      where: { id: "33333333-3333-4333-8333-333333333333" },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    expect(participationUpdate).toHaveBeenCalledWith({
      where: {
        activityId: "33333333-3333-4333-8333-333333333333",
        state: { in: [...ACTIVITY_PARTICIPATION_STATES_CLOSED_ON_CANCEL] },
      },
      data: { state: "CANCELLED", waitlistPosition: null, cancelledAt: now },
    });
    expect(ACTIVITY_PARTICIPATION_STATES_CLOSED_ON_CANCEL).toEqual([
      "CONFIRMED",
      "WAITLISTED",
      "PENDING",
    ]);
  });
});
