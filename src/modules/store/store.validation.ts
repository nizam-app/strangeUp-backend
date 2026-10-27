import { z } from "zod";
import { STORE_LIST_DEFAULT_LIMIT, STORE_LIST_MAX_LIMIT } from "./store.constants.js";

const uuidParam = z.string().uuid();

export const storeProductIdParamSchema = z.object({
  productId: uuidParam,
});

export const storeProductImageParamSchema = z.object({
  productId: uuidParam,
  imageId: uuidParam,
});

export const storeVariantIdParamSchema = z.object({
  variantId: uuidParam,
});

export const storeProductListQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(64).optional(),
  size: z.string().trim().min(1).max(32).optional(),
  color: z.string().trim().min(1).max(32).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(STORE_LIST_MAX_LIMIT).default(STORE_LIST_DEFAULT_LIMIT),
});

export const storeCartItemBodySchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

export type StoreProductListQuery = z.infer<typeof storeProductListQuerySchema>;
export type StoreCartItemBody = z.infer<typeof storeCartItemBodySchema>;
