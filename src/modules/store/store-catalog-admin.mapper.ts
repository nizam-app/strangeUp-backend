import type {
  StoreCategory,
  StoreProduct,
  StoreProductImage,
  StoreProductVariant,
} from "../../../generated/prisma/client.js";
import { mapCategory, mapImage, mapVariant } from "./store.mapper.js";
import { buildStoreUnitPricing } from "./store-pricing.service.js";

export type StoreCatalogAdminProductDto = {
  productId: string;
  slug: string;
  title: string;
  description: string;
  status: StoreProduct["status"];
  category: ReturnType<typeof mapCategory>;
  variants: ReturnType<typeof mapVariant>[];
  images: ReturnType<typeof mapImage>[];
  createdAt: string;
  updatedAt: string;
};

export function mapAdminProduct(
  product: StoreProduct & {
    category: Pick<StoreCategory, "slug" | "label">;
    variants: StoreProductVariant[];
    images: StoreProductImage[];
  },
): StoreCatalogAdminProductDto {
  return {
    productId: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    status: product.status,
    category: mapCategory(product.category),
    variants: [...product.variants]
      .sort((a, b) => a.sku.localeCompare(b.sku))
      .map((v) => ({
        ...mapVariant(
          v,
          buildStoreUnitPricing({
            listUnitPriceCents: v.priceCents,
            compareAtUnitPriceCents: v.compareAtPriceCents,
            currency: v.currency,
          }),
        ),
        updatedAt: v.updatedAt.toISOString(),
      })),
    images: [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).map(mapImage),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
