import { describe, expect, it } from "vitest";
import {
  canDecreaseMemberCapacity,
  canNonMemberSeeCover,
  canRemoveMember,
  decideApproveRequest,
  decideDeclineRequest,
  decideGroupJoin,
  decideGroupLeave,
  hasOpenMemberSeat,
  isValidGroupTag,
  normalizeGroupTag,
} from "../src/modules/groups/group-policy.js";

describe("group membership decisions", () => {
  it("joins PUBLIC groups immediately and PRIVATE groups as pending", () => {
    expect(
      decideGroupJoin({
        groupStatus: "ACTIVE",
        privacy: "PUBLIC",
        existingStatus: null,
        hasOpenSeat: true,
      }),
    ).toBe("join_immediate");
    expect(
      decideGroupJoin({
        groupStatus: "ACTIVE",
        privacy: "PRIVATE_APPROVAL",
        existingStatus: null,
        hasOpenSeat: true,
      }),
    ).toBe("request_pending");
  });

  it("forces declined or removed users through moderated reapply even on PUBLIC groups", () => {
    expect(
      decideGroupJoin({
        groupStatus: "ACTIVE",
        privacy: "PUBLIC",
        existingStatus: "DECLINED",
        hasOpenSeat: true,
      }),
    ).toBe("moderated_reapply");
    expect(
      decideGroupJoin({
        groupStatus: "ACTIVE",
        privacy: "PUBLIC",
        existingStatus: "REMOVED",
        hasOpenSeat: true,
      }),
    ).toBe("moderated_reapply");
    expect(
      decideGroupJoin({
        groupStatus: "ACTIVE",
        privacy: "PUBLIC",
        existingStatus: "LEFT",
        hasOpenSeat: true,
      }),
    ).toBe("join_immediate");
  });

  it("is idempotent for active and pending memberships and blocks archived or full groups", () => {
    expect(
      decideGroupJoin({
        groupStatus: "ACTIVE",
        privacy: "PUBLIC",
        existingStatus: "ACTIVE",
        hasOpenSeat: false,
      }),
    ).toBe("already_active");
    expect(
      decideGroupJoin({
        groupStatus: "ACTIVE",
        privacy: "PRIVATE_APPROVAL",
        existingStatus: "PENDING",
        hasOpenSeat: true,
      }),
    ).toBe("already_pending");
    expect(
      decideGroupJoin({
        groupStatus: "ARCHIVED",
        privacy: "PUBLIC",
        existingStatus: null,
        hasOpenSeat: true,
      }),
    ).toBe("closed");
    expect(
      decideGroupJoin({
        groupStatus: "ACTIVE",
        privacy: "PUBLIC",
        existingStatus: null,
        hasOpenSeat: false,
      }),
    ).toBe("full");
  });

  it("preserves the last owner and treats leave as idempotent", () => {
    expect(decideGroupLeave({ existingStatus: "ACTIVE", role: "OWNER" })).toBe("owner_blocked");
    expect(decideGroupLeave({ existingStatus: "ACTIVE", role: "MEMBER" })).toBe("leave_active");
    expect(decideGroupLeave({ existingStatus: "PENDING", role: "MEMBER" })).toBe("cancel_pending");
    expect(decideGroupLeave({ existingStatus: "LEFT", role: "MEMBER" })).toBe("already_left");
  });

  it("approves only pending requests when a seat is open", () => {
    expect(
      decideApproveRequest({ status: "PENDING", hasOpenSeat: true, groupStatus: "ACTIVE" }),
    ).toBe("approve");
    expect(
      decideApproveRequest({ status: "ACTIVE", hasOpenSeat: true, groupStatus: "ACTIVE" }),
    ).toBe("already_active");
    expect(
      decideApproveRequest({ status: "PENDING", hasOpenSeat: false, groupStatus: "ACTIVE" }),
    ).toBe("full");
    expect(
      decideApproveRequest({ status: "PENDING", hasOpenSeat: true, groupStatus: "ARCHIVED" }),
    ).toBe("closed");
    expect(decideDeclineRequest("PENDING")).toBe("decline");
    expect(decideDeclineRequest("DECLINED")).toBe("already_declined");
    expect(decideDeclineRequest("ACTIVE")).toBe("not_pending");
  });

  it("restricts removals so the owner cannot be removed and mods cannot remove mods", () => {
    expect(canRemoveMember("OWNER", "MEMBER")).toBe(true);
    expect(canRemoveMember("OWNER", "MODERATOR")).toBe(true);
    expect(canRemoveMember("OWNER", "OWNER")).toBe(false);
    expect(canRemoveMember("MODERATOR", "MEMBER")).toBe(true);
    expect(canRemoveMember("MODERATOR", "MODERATOR")).toBe(false);
    expect(canRemoveMember("MEMBER", "MEMBER")).toBe(false);
  });

  it("counts capacity against active members only", () => {
    expect(hasOpenMemberSeat(3, 4)).toBe(true);
    expect(hasOpenMemberSeat(4, 4)).toBe(false);
    expect(hasOpenMemberSeat(40, null)).toBe(true);
    expect(canDecreaseMemberCapacity(4, 4)).toBe(true);
    expect(canDecreaseMemberCapacity(3, 4)).toBe(false);
  });

  it("keeps private covers member-only", () => {
    expect(canNonMemberSeeCover({ privacy: "PUBLIC", status: "ACTIVE" })).toBe(true);
    expect(canNonMemberSeeCover({ privacy: "PRIVATE_APPROVAL", status: "ACTIVE" })).toBe(false);
    expect(canNonMemberSeeCover({ privacy: "PUBLIC", status: "ARCHIVED" })).toBe(false);
  });

  it("normalizes and validates bounded tags", () => {
    expect(normalizeGroupTag(" Bike-Club ")).toBe("bike-club");
    expect(isValidGroupTag("bike-club")).toBe(true);
    expect(isValidGroupTag("ab")).toBe(true);
    expect(isValidGroupTag("-nope")).toBe(false);
    expect(isValidGroupTag("no spaces")).toBe(false);
  });
});
