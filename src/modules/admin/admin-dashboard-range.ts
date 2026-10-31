export const DASHBOARD_RANGE_IDS = [
  "last_30_days",
  "last_90_days",
  "last_12_months",
  "all_time",
] as const;

export type DashboardRangeId = (typeof DASHBOARD_RANGE_IDS)[number];

export type DashboardGranularity = "day" | "week" | "month";

export type DashboardRangeWindow = {
  id: DashboardRangeId;
  label: string;
  timezone: "UTC";
  from: Date;
  to: Date;
  previousFrom: Date | null;
  previousTo: Date | null;
  granularity: DashboardGranularity;
  /** All-time windows older than this many monthly buckets are truncated from the left. */
  truncatedFromHistory: boolean;
};

export const DASHBOARD_TIMEZONE = "UTC" as const;
export const DASHBOARD_ALL_TIME_MAX_MONTHS = 36;
export const DASHBOARD_GROWTH_SAMPLE_CAP = 20_000;

const RANGE_LABELS: Record<DashboardRangeId, string> = {
  last_30_days: "Last 30 Days",
  last_90_days: "Last 90 Days",
  last_12_months: "Last 12 Months",
  all_time: "All-time",
};

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** ISO week (Monday) in UTC. */
export function startOfUtcWeek(date: Date): Date {
  const day = startOfUtcDay(date);
  const weekday = day.getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  day.setUTCDate(day.getUTCDate() - offset);
  return day;
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function resolveDashboardRange(input: {
  range: DashboardRangeId;
  now?: Date;
  earliestRecordAt?: Date | null;
}): DashboardRangeWindow {
  const now = input.now ?? new Date();
  const to = now;
  const toDay = startOfUtcDay(to);

  if (input.range === "last_30_days") {
    const from = addUtcDays(toDay, -29);
    return buildBoundedWindow("last_30_days", from, to, "day");
  }
  if (input.range === "last_90_days") {
    const from = addUtcDays(toDay, -89);
    return buildBoundedWindow("last_90_days", from, to, "week");
  }
  if (input.range === "last_12_months") {
    const from = addUtcMonths(startOfUtcMonth(to), -11);
    return buildBoundedWindow("last_12_months", from, to, "month");
  }

  const earliest = input.earliestRecordAt ? new Date(input.earliestRecordAt) : null;
  const floor = addUtcMonths(startOfUtcMonth(to), -(DASHBOARD_ALL_TIME_MAX_MONTHS - 1));
  if (!earliest || Number.isNaN(earliest.getTime())) {
    return {
      id: "all_time",
      label: RANGE_LABELS.all_time,
      timezone: DASHBOARD_TIMEZONE,
      from: floor,
      to,
      previousFrom: null,
      previousTo: null,
      granularity: "month",
      truncatedFromHistory: false,
    };
  }
  const earliestMonth = startOfUtcMonth(earliest);
  const truncated = earliestMonth.getTime() < floor.getTime();
  return {
    id: "all_time",
    label: RANGE_LABELS.all_time,
    timezone: DASHBOARD_TIMEZONE,
    from: truncated ? floor : earliestMonth,
    to,
    previousFrom: null,
    previousTo: null,
    granularity: "month",
    truncatedFromHistory: truncated,
  };
}

function buildBoundedWindow(
  id: Exclude<DashboardRangeId, "all_time">,
  from: Date,
  to: Date,
  granularity: DashboardGranularity,
): DashboardRangeWindow {
  const previous =
    id === "last_30_days"
      ? { previousFrom: addUtcDays(from, -30), previousTo: from }
      : id === "last_90_days"
        ? { previousFrom: addUtcDays(from, -90), previousTo: from }
        : { previousFrom: addUtcMonths(from, -12), previousTo: from };
  return {
    id,
    label: RANGE_LABELS[id],
    timezone: DASHBOARD_TIMEZONE,
    from,
    to,
    previousFrom: previous.previousFrom,
    previousTo: previous.previousTo,
    granularity,
    truncatedFromHistory: false,
  };
}

export function bucketStartUtc(date: Date, granularity: DashboardGranularity): Date {
  if (granularity === "day") {
    return startOfUtcDay(date);
  }
  if (granularity === "week") {
    return startOfUtcWeek(date);
  }
  return startOfUtcMonth(date);
}

export function enumerateBuckets(input: {
  from: Date;
  to: Date;
  granularity: DashboardGranularity;
}): Date[] {
  const buckets: Date[] = [];
  let cursor = bucketStartUtc(input.from, input.granularity);
  const end = input.to.getTime();
  const guard = 400;
  while (cursor.getTime() <= end && buckets.length < guard) {
    buckets.push(new Date(cursor.getTime()));
    if (input.granularity === "day") {
      cursor = addUtcDays(cursor, 1);
    } else if (input.granularity === "week") {
      cursor = addUtcDays(cursor, 7);
    } else {
      cursor = addUtcMonths(cursor, 1);
    }
  }
  return buckets;
}

export function formatBucketLabel(date: Date, granularity: DashboardGranularity): string {
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  if (granularity === "month") {
    const year = date.getUTCFullYear();
    return `${month} ${year}`;
  }
  return `${month} ${date.getUTCDate()}`;
}

export function countByBucket(
  timestamps: Date[],
  buckets: Date[],
  granularity: DashboardGranularity,
): number[] {
  const counts = buckets.map(() => 0);
  const index = new Map<number, number>();
  buckets.forEach((bucket, i) => {
    index.set(bucket.getTime(), i);
  });
  for (const stamp of timestamps) {
    const key = bucketStartUtc(stamp, granularity).getTime();
    const i = index.get(key);
    if (i !== undefined) {
      counts[i] += 1;
    }
  }
  return counts;
}

export function runningTotal(baseline: number, periodCounts: number[]): number[] {
  let running = baseline;
  return periodCounts.map((count) => {
    running += count;
    return running;
  });
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
