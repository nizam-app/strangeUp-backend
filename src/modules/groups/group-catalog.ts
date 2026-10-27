/** Provisional group-category catalog (Screen 14 / Create Group). Distinct from Interests and ActivityCategory. */
export type GroupCategoryCatalogEntry = {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
};

export const GROUP_CATEGORY_CATALOG: readonly GroupCategoryCatalogEntry[] = [
  { id: "c1000001-0000-4000-8000-000000000001", slug: "sports", label: "Sports", sortOrder: 1 },
  { id: "c1000001-0000-4000-8000-000000000002", slug: "fitness", label: "Fitness", sortOrder: 2 },
  { id: "c1000001-0000-4000-8000-000000000003", slug: "outdoor", label: "Outdoor", sortOrder: 3 },
  { id: "c1000001-0000-4000-8000-000000000004", slug: "social", label: "Social", sortOrder: 4 },
  { id: "c1000001-0000-4000-8000-000000000005", slug: "hobbies", label: "Hobbies", sortOrder: 5 },
];

export const GROUP_CATEGORY_SLUGS = GROUP_CATEGORY_CATALOG.map((entry) => entry.slug) as [
  (typeof GROUP_CATEGORY_CATALOG)[number]["slug"],
  ...(typeof GROUP_CATEGORY_CATALOG)[number]["slug"][],
];

export const GROUP_CATEGORY_SLUG_SET = new Set<string>(GROUP_CATEGORY_SLUGS);
