import type { ActivityStatus } from "../../../generated/prisma/client.js";

export type ActivityWhenFilter = "upcoming" | "past" | "all";

export type MyActivityInventoryView =
  | "upcoming"
  | "hosting"
  | "joined"
  | "waitlisted"
  | "pending"
  | "past";

export function activityStartsAtWhere(
  when: ActivityWhenFilter,
  now: Date,
): { startsAt?: { gt: Date } | { lte: Date } } {
  if (when === "all") {
    return {};
  }
  if (when === "upcoming") {
    return { startsAt: { gt: now } };
  }
  return { startsAt: { lte: now } };
}

/** Host-owned rows shown in My Activities inventory (excludes terminal lifecycle). */
export function isHostInventoryEligibleStatus(status: ActivityStatus): boolean {
  return status !== "CANCELLED" && status !== "COMPLETED";
}

/** Participant list activities must remain published and not host-cancelled. */
export const participantInventoryActivityWhere = {
  status: "PUBLISHED" as const,
  cancelledAt: null,
};

export type InventorySortRow = {
  activityId: string;
  startsAt: Date;
};

export function compareInventoryAsc(a: InventorySortRow, b: InventorySortRow): number {
  const byStart = a.startsAt.getTime() - b.startsAt.getTime();
  if (byStart !== 0) {
    return byStart;
  }
  return a.activityId.localeCompare(b.activityId);
}

export function compareInventoryDesc(a: InventorySortRow, b: InventorySortRow): number {
  return -compareInventoryAsc(a, b);
}

export function mergeInventoryPages(
  pages: InventorySortRow[][],
  limit: number,
  compare: (a: InventorySortRow, b: InventorySortRow) => number,
): { page: InventorySortRow[]; hasMore: boolean } {
  const seen = new Set<string>();
  const merged: InventorySortRow[] = [];
  const pointers = pages.map(() => 0);
  const sortedInputs = pages.map((rows) => [...rows].sort(compare));

  while (merged.length < limit + 1) {
    let bestIndex = -1;
    for (let i = 0; i < sortedInputs.length; i += 1) {
      const row = sortedInputs[i][pointers[i]];
      if (!row || seen.has(row.activityId)) {
        if (row && seen.has(row.activityId)) {
          pointers[i] += 1;
        }
        continue;
      }
      if (bestIndex === -1 || compare(row, sortedInputs[bestIndex][pointers[bestIndex]]) < 0) {
        bestIndex = i;
      }
    }
    if (bestIndex === -1) {
      break;
    }
    const chosen = sortedInputs[bestIndex][pointers[bestIndex]];
    pointers[bestIndex] += 1;
    if (seen.has(chosen.activityId)) {
      continue;
    }
    seen.add(chosen.activityId);
    merged.push(chosen);
  }

  const hasMore = merged.length > limit;
  return { page: merged.slice(0, limit), hasMore };
}

export function rowAfterCursor(
  row: InventorySortRow,
  cursor: InventorySortRow,
  ascending: boolean,
): boolean {
  const cmp = compareInventoryAsc(row, cursor);
  if (ascending) {
    return cmp > 0;
  }
  return cmp < 0;
}
