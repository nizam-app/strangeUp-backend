import { z } from "zod";
import {
  STORE_CART_MAX_QUANTITY,
  STORE_LIST_DEFAULT_LIMIT,
  STORE_LIST_MAX_LIMIT,
  STORE_PRODUCT_DESCRIPTION_MAX,
  STORE_PRODUCT_TITLE_MAX,
} from "./store.constants.js";

const uuidParam = z.string().uuid();
const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens");

const currencySchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/);

export const storeCatalogAdminProductIdParamSchema = z.object({
  productId: uuidParam,
});

export const storeCatalogAdminVariantParamSchema = z.object({
  productId: uuidParam,
  variantId: uuidParam,
});

export const storeCatalogAdminImageParamSchema = z.object({
  productId: uuidParam,
  imageId: uuidParam,
});

export const storeCatalogAdminListQuerySchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(STORE_LIST_MAX_LIMIT).default(STORE_LIST_DEFAULT_LIMIT),
});

export const storeCatalogAdminCreateProductSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(STORE_PRODUCT_TITLE_MAX),
  description: z.string().trim().min(1).max(STORE_PRODUCT_DESCRIPTION_MAX),
  categorySlug: z.string().trim().min(1).max(64),
});

export const storeCatalogAdminPatchProductSchema = z
  .object({
    slug: slugSchema.optional(),
    title: z.string().trim().min(1).max(STORE_PRODUCT_TITLE_MAX).optional(),
    description: z.string().trim().min(1).max(STORE_PRODUCT_DESCRIPTION_MAX).optional(),
    categorySlug: z.string().trim().min(1).max(64).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

export const storeCatalogAdminCreateVariantSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  sizeLabel: z.string().trim().min(1).max(32).nullable().optional(),
  colorLabel: z.string().trim().min(1).max(32).nullable().optional(),
  priceCents: z.number().int().min(0).max(100_000_000),
  compareAtPriceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  currency: currencySchema.default("USD"),
  stockQuantity: z.number().int().min(0).max(STORE_CART_MAX_QUANTITY * 1000),
  isActive: z.boolean().default(true),
});

export const storeCatalogAdminPatchVariantSchema = z
  .object({
    sizeLabel: z.string().trim().min(1).max(32).nullable().optional(),
    colorLabel: z.string().trim().min(1).max(32).nullable().optional(),
    priceCents: z.number().int().min(0).max(100_000_000).optional(),
    compareAtPriceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
    currency: currencySchema.optional(),
    stockQuantity: z.number().int().min(0).max(STORE_CART_MAX_QUANTITY * 1000).optional(),
    isActive: z.boolean().optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

export const storeCatalogAdminStockPatchSchema = z.object({
  stockQuantity: z.number().int().min(0).max(STORE_CART_MAX_QUANTITY * 1000),
  expectedUpdatedAt: z.string().datetime(),
});

export const storeCatalogAdminImageSortSchema = z.object({
  sortOrder: z.number().int().min(0).max(1000),
});

export type StoreCatalogAdminListQuery = z.infer<typeof storeCatalogAdminListQuerySchema>;
export type StoreCatalogAdminCreateProduct = z.infer<typeof storeCatalogAdminCreateProductSchema>;
export type StoreCatalogAdminPatchProduct = z.infer<typeof storeCatalogAdminPatchProductSchema>;
export type StoreCatalogAdminCreateVariant = z.infer<typeof storeCatalogAdminCreateVariantSchema>;
export type StoreCatalogAdminPatchVariant = z.infer<typeof storeCatalogAdminPatchVariantSchema>;
