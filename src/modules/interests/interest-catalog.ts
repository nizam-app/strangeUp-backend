/** Owner-approved Task 007 catalog (Figma Edit Personal Details). Stable IDs for migration seed parity. */
export type InterestCatalogEntry = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
};

export const INTEREST_CATALOG: readonly InterestCatalogEntry[] = [
  { id: "a1000001-0000-4000-8000-000000000001", slug: "biking", label: "Biking", sortOrder: 1 },
  { id: "a1000001-0000-4000-8000-000000000002", slug: "fitness", label: "Fitness", sortOrder: 2 },
  { id: "a1000001-0000-4000-8000-000000000003", slug: "outdoor", label: "Outdoor", sortOrder: 3 },
  { id: "a1000001-0000-4000-8000-000000000004", slug: "social", label: "Social", sortOrder: 4 },
  { id: "a1000001-0000-4000-8000-000000000005", slug: "sports", label: "Sports", sortOrder: 5 },
  { id: "a1000001-0000-4000-8000-000000000006", slug: "swimming", label: "Swimming", sortOrder: 6 },
  { id: "a1000001-0000-4000-8000-000000000007", slug: "hiking", label: "Hiking", sortOrder: 7 },
  { id: "a1000001-0000-4000-8000-000000000008", slug: "travel", label: "Travel", sortOrder: 8 },
  { id: "a1000001-0000-4000-8000-000000000009", slug: "music", label: "Music", sortOrder: 9 },
  { id: "a1000001-0000-4000-8000-000000000010", slug: "food", label: "Food", sortOrder: 10 },
];

export const INTEREST_SLUGS = INTEREST_CATALOG.map((entry) => entry.slug) as [
  (typeof INTEREST_CATALOG)[number]["slug"],
  ...(typeof INTEREST_CATALOG)[number]["slug"][],
];

export const INTEREST_MAX_SELECTION = INTEREST_CATALOG.length;

export const INTEREST_SLUG_SET = new Set<string>(INTEREST_SLUGS);
