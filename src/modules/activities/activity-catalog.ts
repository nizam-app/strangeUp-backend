/** Figma-grounded activity catalog (Screens 11–13). Distinct from profile Interests. */
export type ActivityCategoryCatalogEntry = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
};

export const ACTIVITY_CATEGORY_CATALOG: readonly ActivityCategoryCatalogEntry[] = [
  { id: "b1000001-0000-4000-8000-000000000001", slug: "biking", label: "Biking", sortOrder: 1 },
  {
    id: "b1000001-0000-4000-8000-000000000002",
    slug: "padel-tennis",
    label: "Padel & Tennis",
    sortOrder: 2,
  },
  { id: "b1000001-0000-4000-8000-000000000003", slug: "running", label: "Running", sortOrder: 3 },
  { id: "b1000001-0000-4000-8000-000000000004", slug: "swimming", label: "Swimming", sortOrder: 4 },
  { id: "b1000001-0000-4000-8000-000000000005", slug: "fitness", label: "Fitness", sortOrder: 5 },
];

export const ACTIVITY_CATEGORY_SLUGS = ACTIVITY_CATEGORY_CATALOG.map((entry) => entry.slug) as [
  (typeof ACTIVITY_CATEGORY_CATALOG)[number]["slug"],
  ...(typeof ACTIVITY_CATEGORY_CATALOG)[number]["slug"][],
];

export const ACTIVITY_CATEGORY_SLUG_SET = new Set<string>(ACTIVITY_CATEGORY_SLUGS);
