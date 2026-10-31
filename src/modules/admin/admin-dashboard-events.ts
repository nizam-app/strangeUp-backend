import { AppError } from "../../common/errors/app-error.js";

export const DASHBOARD_EVENT_CATEGORIES = [
  "all",
  "verifications",
  "groups",
  "reports",
  "transactions",
] as const;

export type DashboardEventCategory = (typeof DASHBOARD_EVENT_CATEGORIES)[number];

export const DASHBOARD_EVENT_SOURCES = [
  "IDENTITY_REVIEW",
  "ACCOUNT_MODERATION",
  "ACTIVITY_MODERATION",
] as const;

export type DashboardEventSource = (typeof DASHBOARD_EVENT_SOURCES)[number];

export const UNSUPPORTED_DASHBOARD_EVENT_FEEDS: Record<
  Exclude<DashboardEventCategory, "all" | "verifications">,
  { trackerId: string; reason: string }
> = {
  groups: {
    trackerId: "BE-064",
    reason:
      "Group creation is not a staff governance audit event, and the Groups Admin module is not implemented.",
  },
  reports: {
    trackerId: "BE-065",
    reason:
      "No platform-wide report/flag queue or Admin Reports details page exists. Group content reports are not surfaced here.",
  },
  transactions: {
    trackerId: "BE-066",
    reason: "No settled payment or transaction ledger exists.",
  },
};

export type DashboardRecentEvent = {
  eventId: string;
  source: DashboardEventSource;
  eventType: string;
  eventTypeLabel: string;
  subject: {
    kind: "USER" | "ACTIVITY";
    id: string;
    displayName: string;
    hasAvatar: boolean;
    href: string | null;
  };
  entity: {
    kind: "IDENTITY_REVIEW" | "ACCOUNT" | "ACTIVITY";
    id: string;
    label: string;
    href: string | null;
  };
  occurredAt: string;
  status: string;
  statusLabel: string;
  action: { label: string; href: string } | null;
};

export function encodeDashboardEventsCursor(value: {
  occurredAt: Date;
  eventId: string;
  source: DashboardEventSource;
  filterFingerprint: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      t: value.occurredAt.toISOString(),
      i: value.eventId,
      s: value.source,
      f: value.filterFingerprint,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeDashboardEventsCursor(
  raw: string | undefined,
  expectedFingerprint: string,
): { occurredAt: Date; eventId: string; source: DashboardEventSource } | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      t?: string;
      i?: string;
      s?: string;
      f?: string;
    };
    if (!parsed.t || !parsed.i || !parsed.s || parsed.f !== expectedFingerprint) {
      throw new AppError("VALIDATION_ERROR", "Invalid pagination cursor", 400);
    }
    if (!DASHBOARD_EVENT_SOURCES.includes(parsed.s as DashboardEventSource)) {
      throw new AppError("VALIDATION_ERROR", "Invalid pagination cursor", 400);
    }
    const occurredAt = new Date(parsed.t);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new AppError("VALIDATION_ERROR", "Invalid pagination cursor", 400);
    }
    return { occurredAt, eventId: parsed.i, source: parsed.s as DashboardEventSource };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("VALIDATION_ERROR", "Invalid pagination cursor", 400);
  }
}

export function dashboardEventsFilterFingerprint(category: DashboardEventCategory): string {
  return `dashboard-events:${category}`;
}

export function sourcesForEventCategory(
  category: DashboardEventCategory,
): DashboardEventSource[] | null {
  if (category === "all") {
    return [...DASHBOARD_EVENT_SOURCES];
  }
  if (category === "verifications") {
    return ["IDENTITY_REVIEW"];
  }
  return null;
}

export function compareDashboardEventsNewestFirst(
  a: { occurredAt: Date; eventId: string; source: DashboardEventSource },
  b: { occurredAt: Date; eventId: string; source: DashboardEventSource },
): number {
  const byTime = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  const byId = b.eventId.localeCompare(a.eventId);
  if (byId !== 0) {
    return byId;
  }
  return b.source.localeCompare(a.source);
}

export function presentIdentityReviewEvent(input: {
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  displayName: string | null;
  hasAvatar: boolean;
}): DashboardRecentEvent {
  const mapped = mapIdentityStatus(input.status);
  return {
    eventId: input.id,
    source: "IDENTITY_REVIEW",
    eventType: mapped.eventType,
    eventTypeLabel: mapped.eventTypeLabel,
    subject: {
      kind: "USER",
      id: input.userId,
      displayName: input.displayName?.trim() || "Applicant",
      hasAvatar: input.hasAvatar,
      href: `/verification/${input.userId}`,
    },
    entity: {
      kind: "IDENTITY_REVIEW",
      id: input.userId,
      label: "Identity review",
      href: `/verification/${input.userId}`,
    },
    occurredAt: input.createdAt.toISOString(),
    status: mapped.status,
    statusLabel: mapped.statusLabel,
    action: { label: "Review", href: `/verification/${input.userId}` },
  };
}

export function presentAccountModerationEvent(input: {
  id: string;
  userId: string;
  action: string;
  resultingAccountStatus: string;
  createdAt: Date;
  displayName: string | null;
  hasAvatar: boolean;
}): DashboardRecentEvent {
  const isSuspend = input.action === "SUSPEND";
  return {
    eventId: input.id,
    source: "ACCOUNT_MODERATION",
    eventType: isSuspend ? "ACCOUNT_SUSPENDED" : "ACCOUNT_RESTORED",
    eventTypeLabel: isSuspend ? "Account suspended" : "Account restored",
    subject: {
      kind: "USER",
      id: input.userId,
      displayName: input.displayName?.trim() || "Member",
      hasAvatar: input.hasAvatar,
      href: `/users/${input.userId}`,
    },
    entity: {
      kind: "ACCOUNT",
      id: input.userId,
      label: "Account",
      href: `/users/${input.userId}`,
    },
    occurredAt: input.createdAt.toISOString(),
    status: input.resultingAccountStatus,
    statusLabel: isSuspend ? "Suspended" : "Restored",
    action: { label: "View user", href: `/users/${input.userId}` },
  };
}

export function presentActivityModerationEvent(input: {
  id: string;
  activityId: string;
  action: string;
  createdAt: Date;
  title: string | null;
}): DashboardRecentEvent {
  const title = input.title?.trim() || "Activity";
  return {
    eventId: input.id,
    source: "ACTIVITY_MODERATION",
    eventType: "ACTIVITY_CANCELLED",
    eventTypeLabel: "Activity cancelled by staff",
    subject: {
      kind: "ACTIVITY",
      id: input.activityId,
      displayName: title,
      hasAvatar: false,
      href: `/activities/${input.activityId}`,
    },
    entity: {
      kind: "ACTIVITY",
      id: input.activityId,
      label: title,
      href: `/activities/${input.activityId}`,
    },
    occurredAt: input.createdAt.toISOString(),
    status: "CANCELLED",
    statusLabel: "Cancelled",
    action: { label: "Inspect", href: `/activities/${input.activityId}` },
  };
}

function mapIdentityStatus(status: string): {
  eventType: string;
  eventTypeLabel: string;
  status: string;
  statusLabel: string;
} {
  switch (status) {
    case "APPROVED":
      return {
        eventType: "PLATFORM_HOME_APPROVED",
        eventTypeLabel: "Home access approved",
        status: "APPROVED",
        statusLabel: "Approved",
      };
    case "REJECTED":
      return {
        eventType: "PLATFORM_HOME_REJECTED",
        eventTypeLabel: "Platform review rejected",
        status: "REJECTED",
        statusLabel: "Rejected",
      };
    case "NEEDS_FURTHER_REVIEW":
      return {
        eventType: "IDENTITY_HELD",
        eventTypeLabel: "Held for further review",
        status: "NEEDS_FURTHER_REVIEW",
        statusLabel: "On hold",
      };
    default:
      return {
        eventType: "IDENTITY_REVIEW_UPDATE",
        eventTypeLabel: "Identity review update",
        status,
        statusLabel: status.replace(/_/g, " "),
      };
  }
}

export function cursorWhere(cursor: { occurredAt: Date; eventId: string } | null) {
  if (!cursor) {
    return undefined;
  }
  return {
    OR: [
      { createdAt: { lt: cursor.occurredAt } },
      { AND: [{ createdAt: cursor.occurredAt }, { id: { lt: cursor.eventId } }] },
    ],
  };
}
