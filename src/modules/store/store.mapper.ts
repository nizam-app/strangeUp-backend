import type {
  StoreCategory,
  StoreProduct,
  StoreProductImage,
  StoreProductVariant,
} from "../../../generated/prisma/client.js";
import { buildStoreUnitPricing } from "./store-pricing.service.js";
import type {
  StoreMerchandisePricingPolicyDto,
  StoreProductPricingHintDto,
  StoreUnitPricingDto,
} from "./store-pricing.types.js";

export type StoreCategoryDto = {
  slug: string;
  label: string;
};

export type StoreProductVariantDto = {
  variantId: string;
  sku: string;
  sizeLabel: string | null;
  colorLabel: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  stockQuantity: number;
  inStock: boolean;
  pricing: StoreUnitPricingDto;
};

export type StoreProductImageDto = {
  imageId: string;
  sortOrder: number;
};

export type StoreProductSummaryDto = {
  productId: string;
  slug: string;
  title: string;
  category: StoreCategoryDto;
  primaryImageId: string | null;
  priceFromCents: number | null;
  currency: string | null;
  isFavorited: boolean;
  pricingHint: StoreProductPricingHintDto;
};

export type StoreProductDetailDto = StoreProductSummaryDto & {
  description: string;
  variants: StoreProductVariantDto[];
  images: StoreProductImageDto[];
  merchandisePricingPolicy: StoreMerchandisePricingPolicyDto;
};

export function mapCategory(category: Pick<StoreCategory, "slug" | "label">): StoreCategoryDto {
  return { slug: category.slug, label: category.label };
}

export function mapVariant(
  variant: StoreProductVariant,
  pricing: StoreUnitPricingDto,
): StoreProductVariantDto {
  return {
    variantId: variant.id,
    sku: variant.sku,
    sizeLabel: variant.sizeLabel,
    colorLabel: variant.colorLabel,
    priceCents: variant.priceCents,
    compareAtPriceCents: variant.compareAtPriceCents,
    currency: variant.currency,
    stockQuantity: variant.stockQuantity,
    inStock: variant.isActive && variant.stockQuantity > 0,
    pricing,
  };
}

export function mapImage(image: StoreProductImage): StoreProductImageDto {
  return { imageId: image.id, sortOrder: image.sortOrder };
}

export function summarizeProduct(
  product: StoreProduct & {
    category: Pick<StoreCategory, "slug" | "label">;
    variants: StoreProductVariant[];
    images: StoreProductImage[];
  },
  isFavorited: boolean,
  pricingHint: StoreProductPricingHintDto,
): StoreProductSummaryDto {
  const activeVariants = product.variants.filter((v) => v.isActive);
  const priced = activeVariants.filter((v) => v.priceCents >= 0);
  const minPrice = priced.length > 0 ? Math.min(...priced.map((v) => v.priceCents)) : null;
  const firstPriced = priced[0];
  const currency = firstPriced ? firstPriced.currency : null;
  const primaryImage = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];

  return {
    productId: product.id,
    slug: product.slug,
    title: product.title,
    category: mapCategory(product.category),
    primaryImageId: primaryImage?.id ?? null,
    priceFromCents: minPrice,
    currency,
    isFavorited,
    pricingHint,
  };
}

export function mapProductDetail(
  product: StoreProduct & {
    category: Pick<StoreCategory, "slug" | "label">;
    variants: StoreProductVariant[];
    images: StoreProductImage[];
  },
  isFavorited: boolean,
  pricingHint: StoreProductPricingHintDto,
  merchandisePricingPolicy: StoreProductDetailDto["merchandisePricingPolicy"],
): StoreProductDetailDto {
  const summary = summarizeProduct(product, isFavorited, pricingHint);
  return {
    ...summary,
    description: product.description,
    variants: product.variants
      .filter((v) => v.isActive)
      .map((v) =>
        mapVariant(
          v,
          buildStoreUnitPricing({
            listUnitPriceCents: v.priceCents,
            compareAtUnitPriceCents: v.compareAtPriceCents,
            currency: v.currency,
          }),
        ),
      )
      .sort((a, b) => a.sku.localeCompare(b.sku)),
    images: [...product.images].sort((a, b) => a.sortOrder - b.sortOrder).map(mapImage),
    merchandisePricingPolicy,
  };
}
