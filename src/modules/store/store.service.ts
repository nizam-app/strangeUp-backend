import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { assertStoreAccess } from "./store-access.js";
import { decodeStoreProductCursor, encodeStoreProductCursor } from "./store-cursor.js";
import type { StoreProductImageStorage } from "./store-product-image.storage.js";
import { mapCategory, mapProductDetail, summarizeProduct } from "./store.mapper.js";
import {
  buildActivityPickupEligibilitySpec,
  buildStoreFulfillmentPolicy,
} from "../physical-commerce/physical-commerce-fulfillment.service.js";
import {
  buildStoreMerchandisePricingPolicy,
  buildStoreProductPricingHint,
} from "./store-pricing.service.js";
import type { StoreProductListQuery } from "./store.validation.js";

const productInclude = {
  category: { select: { slug: true, label: true } },
  variants: true,
  images: true,
} as const;

export class StoreCatalogService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly imageStorage: StoreProductImageStorage,
  ) {}

  async listCategories(user: User) {
    assertStoreAccess(user);
    const rows = await this.db.storeCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    });
    return { categories: rows.map(mapCategory) };
  }

  getMerchandisePricingPolicy(user: User) {
    assertStoreAccess(user);
    return buildStoreMerchandisePricingPolicy();
  }

  getFulfillmentPolicy(user: User) {
    assertStoreAccess(user);
    return {
      fulfillment: buildStoreFulfillmentPolicy(),
      activityPickupEligibility: buildActivityPickupEligibilitySpec(),
    };
  }

  async listProducts(user: User, query: StoreProductListQuery) {
    assertStoreAccess(user);
    const limit = query.limit;
    const cursor = query.cursor ? decodeStoreProductCursor(query.cursor) : null;

    const categoryFilter = query.category
      ? await this.db.storeCategory.findFirst({
          where: { slug: query.category, isActive: true },
          select: { id: true },
        })
      : null;
    if (query.category && !categoryFilter) {
      return { products: [], nextCursor: null };
    }

    const variantFilter =
      query.size || query.color
        ? {
            some: {
              isActive: true,
              ...(query.size ? { sizeLabel: query.size } : {}),
              ...(query.color ? { colorLabel: query.color } : {}),
            },
          }
        : undefined;

    const rows = await this.db.storeProduct.findMany({
      where: {
        status: "PUBLISHED",
        ...(categoryFilter ? { categoryId: categoryFilter.id } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { description: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(variantFilter ? { variants: variantFilter } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      include: productInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const favoriteIds = await this.loadFavoriteSet(
      user.id,
      page.map((p) => p.id),
    );

    const last = page.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? encodeStoreProductCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    const pricingHint = buildStoreProductPricingHint();
    return {
      products: page.map((p) => summarizeProduct(p, favoriteIds.has(p.id), pricingHint)),
      nextCursor,
    };
  }

  async getProduct(user: User, productId: string) {
    assertStoreAccess(user);
    const product = await this.db.storeProduct.findFirst({
      where: { id: productId, status: "PUBLISHED" },
      include: productInclude,
    });
    if (!product) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }
    const favorited = await this.db.storeFavorite.findUnique({
      where: { userId_productId: { userId: user.id, productId } },
    });
    const pricingHint = buildStoreProductPricingHint();
    return mapProductDetail(
      product,
      favorited !== null,
      pricingHint,
      buildStoreMerchandisePricingPolicy(),
    );
  }

  async getProductImage(user: User, productId: string, imageId: string) {
    assertStoreAccess(user);
    const image = await this.db.storeProductImage.findFirst({
      where: {
        id: imageId,
        productId,
        product: { status: "PUBLISHED" },
      },
    });
    if (!image) {
      throw new AppError("NOT_FOUND", "Image not found", 404);
    }
    const { stream } = await this.imageStorage.openReadStream(image.storageKey);
    return { stream, contentType: image.contentType };
  }

  private async loadFavoriteSet(userId: string, productIds: string[]): Promise<Set<string>> {
    if (productIds.length === 0) {
      return new Set();
    }
    const rows = await this.db.storeFavorite.findMany({
      where: { userId, productId: { in: productIds } },
      select: { productId: true },
    });
    return new Set(rows.map((r) => r.productId));
  }
}
