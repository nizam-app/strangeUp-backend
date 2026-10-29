import { describe, expect, it } from "vitest";
import {
  storeCatalogAdminCreateProductSchema,
  storeCatalogAdminCreateVariantSchema,
} from "../src/modules/store/store-catalog-admin.validation.js";

describe("store catalog admin validation", () => {
  it("accepts valid product create payload", () => {
    const parsed = storeCatalogAdminCreateProductSchema.parse({
      slug: "test-jersey",
      title: "Jersey",
      description: "Desc",
      categorySlug: "cycling",
    });
    expect(parsed.slug).toBe("test-jersey");
  });

  it("rejects invalid slug", () => {
    expect(() =>
      storeCatalogAdminCreateProductSchema.parse({
        slug: "Bad Slug!",
        title: "Jersey",
        description: "Desc",
        categorySlug: "cycling",
      }),
    ).toThrow();
  });

  it("accepts variant with USD currency", () => {
    const parsed = storeCatalogAdminCreateVariantSchema.parse({
      sku: "SKU-1",
      priceCents: 100,
      stockQuantity: 1,
    });
    expect(parsed.currency).toBe("USD");
  });
});
