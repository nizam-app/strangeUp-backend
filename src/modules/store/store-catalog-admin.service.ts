import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { decodeStoreProductCursor, encodeStoreProductCursor } from "./store-cursor.js";
import { assertStoreCatalogManagementEnabled } from "./store-catalog-policy.js";
import { mapAdminProduct } from "./store-catalog-admin.mapper.js";
import type {
  StoreCatalogAdminCreateProduct,
  StoreCatalogAdminCreateVariant,
  StoreCatalogAdminListQuery,
  StoreCatalogAdminPatchProduct,
  StoreCatalogAdminPatchVariant,
} from "./store-catalog-admin.validation.js";
import { processStoreProductImageUpload } from "./store-product-image-processor.js";
import type { StoreProductImageStorage } from "./store-product-image.storage.js";
import {
  STORE_MAX_IMAGES_PER_PRODUCT,
  STORE_MAX_VARIANTS_PER_PRODUCT,
} from "./store-product-image.constants.js";

const productInclude = {
  category: { select: { slug: true, label: true } },
  variants: true,
  images: true,
} as const;

function normalizeOptionLabel(value: string | null | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function variantOptionKey(sizeLabel: string | null, colorLabel: string | null): string {
  return `${sizeLabel ?? ""}\0${colorLabel ?? ""}`;
}

export class StoreCatalogAdminService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
    private readonly imageStorage: StoreProductImageStorage,
  ) {}

  private assertEnabled(): void {
    assertStoreCatalogManagementEnabled(this.env);
  }

  async listCategories(_staff: User) {
    this.assertEnabled();
    const rows = await this.db.storeCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    });
    return { categories: rows.map((c) => ({ slug: c.slug, label: c.label })) };
  }

  async listProducts(_staff: User, query: StoreCatalogAdminListQuery) {
    this.assertEnabled();
    const limit = query.limit;
    const cursor = query.cursor ? decodeStoreProductCursor(query.cursor) : null;

    const rows = await this.db.storeProduct.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { slug: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: productInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? encodeStoreProductCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    return {
      products: page.map(mapAdminProduct),
      nextCursor,
    };
  }

  async getProduct(_staff: User, productId: string) {
    this.assertEnabled();
    const product = await this.db.storeProduct.findUnique({
      where: { id: productId },
      include: productInclude,
    });
    if (!product) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }
    return mapAdminProduct(product);
  }

  async createProduct(_staff: User, input: StoreCatalogAdminCreateProduct) {
    this.assertEnabled();
    const category = await this.db.storeCategory.findFirst({
      where: { slug: input.categorySlug, isActive: true },
    });
    if (!category) {
      throw new AppError("VALIDATION_ERROR", "Unknown or inactive category", 400);
    }

    try {
      const created = await this.db.storeProduct.create({
        data: {
          slug: input.slug,
          title: input.title,
          description: input.description,
          categoryId: category.id,
          status: "DRAFT",
        },
        include: productInclude,
      });
      return mapAdminProduct(created);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError("CONFLICT", "Product slug already exists", 409);
      }
      throw err;
    }
  }

  async patchProduct(_staff: User, productId: string, input: StoreCatalogAdminPatchProduct) {
    this.assertEnabled();
    const existing = await this.db.storeProduct.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }
    if (existing.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Archived products cannot be edited", 400);
    }

    let categoryId: string | undefined;
    if (input.categorySlug) {
      const category = await this.db.storeCategory.findFirst({
        where: { slug: input.categorySlug, isActive: true },
      });
      if (!category) {
        throw new AppError("VALIDATION_ERROR", "Unknown or inactive category", 400);
      }
      categoryId = category.id;
    }

    try {
      const updated = await this.db.storeProduct.update({
        where: { id: productId },
        data: {
          ...(input.slug ? { slug: input.slug } : {}),
          ...(input.title ? { title: input.title } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(categoryId ? { categoryId } : {}),
        },
        include: productInclude,
      });
      return mapAdminProduct(updated);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError("CONFLICT", "Product slug already exists", 409);
      }
      throw err;
    }
  }

  async publishProduct(_staff: User, productId: string) {
    this.assertEnabled();
    await this.assertPublishEligible(productId);
    const updated = await this.db.storeProduct.update({
      where: { id: productId },
      data: { status: "PUBLISHED" },
      include: productInclude,
    });
    return mapAdminProduct(updated);
  }

  async archiveProduct(_staff: User, productId: string) {
    this.assertEnabled();
    const existing = await this.db.storeProduct.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }
    const updated = await this.db.storeProduct.update({
      where: { id: productId },
      data: { status: "ARCHIVED" },
      include: productInclude,
    });
    return mapAdminProduct(updated);
  }

  async createVariant(_staff: User, productId: string, input: StoreCatalogAdminCreateVariant) {
    this.assertEnabled();
    const product = await this.db.storeProduct.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
    if (!product) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }
    if (product.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Cannot add variants to archived product", 400);
    }
    if (product.variants.length >= STORE_MAX_VARIANTS_PER_PRODUCT) {
      throw new AppError("VALIDATION_ERROR", "Variant limit reached", 400);
    }

    const sizeLabel = normalizeOptionLabel(input.sizeLabel);
    const colorLabel = normalizeOptionLabel(input.colorLabel);
    await this.assertVariantOptionsUnique(productId, sizeLabel, colorLabel, null);
    this.assertCompareAtPrice(input.priceCents, input.compareAtPriceCents ?? null);

    try {
      await this.db.storeProductVariant.create({
        data: {
          productId,
          sku: input.sku,
          sizeLabel,
          colorLabel,
          priceCents: input.priceCents,
          compareAtPriceCents: input.compareAtPriceCents ?? null,
          currency: input.currency,
          stockQuantity: input.stockQuantity,
          isActive: input.isActive,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError("CONFLICT", "SKU already exists", 409);
      }
      throw err;
    }

    return this.getProduct(_staff, productId);
  }

  async patchVariant(
    _staff: User,
    productId: string,
    variantId: string,
    input: StoreCatalogAdminPatchVariant,
  ) {
    this.assertEnabled();
    const variant = await this.db.storeProductVariant.findFirst({
      where: { id: variantId, productId },
      include: { product: true },
    });
    if (!variant) {
      throw new AppError("NOT_FOUND", "Variant not found", 404);
    }
    if (variant.product.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Cannot edit variants on archived product", 400);
    }

    if (input.expectedUpdatedAt) {
      const expected = new Date(input.expectedUpdatedAt).getTime();
      if (variant.updatedAt.getTime() !== expected) {
        throw new AppError("CONFLICT", "Variant was modified; refresh and retry", 409);
      }
    }

    const nextSize =
      input.sizeLabel !== undefined ? normalizeOptionLabel(input.sizeLabel) : variant.sizeLabel;
    const nextColor =
      input.colorLabel !== undefined ? normalizeOptionLabel(input.colorLabel) : variant.colorLabel;
    if (input.sizeLabel !== undefined || input.colorLabel !== undefined) {
      await this.assertVariantOptionsUnique(productId, nextSize, nextColor, variantId);
    }

    const nextPrice = input.priceCents ?? variant.priceCents;
    const nextCompare =
      input.compareAtPriceCents !== undefined
        ? input.compareAtPriceCents
        : variant.compareAtPriceCents;
    if (input.priceCents !== undefined || input.compareAtPriceCents !== undefined) {
      this.assertCompareAtPrice(nextPrice, nextCompare);
    }

    await this.db.storeProductVariant.update({
      where: { id: variantId },
      data: {
        ...(input.sizeLabel !== undefined ? { sizeLabel: nextSize } : {}),
        ...(input.colorLabel !== undefined ? { colorLabel: nextColor } : {}),
        ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        ...(input.compareAtPriceCents !== undefined
          ? { compareAtPriceCents: input.compareAtPriceCents }
          : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    return this.getProduct(_staff, productId);
  }

  async patchVariantStock(
    _staff: User,
    productId: string,
    variantId: string,
    stockQuantity: number,
    expectedUpdatedAt: string,
  ) {
    return this.patchVariant(_staff, productId, variantId, {
      stockQuantity,
      expectedUpdatedAt,
    });
  }

  async uploadImage(_staff: User, productId: string, fileBuffer: Buffer) {
    this.assertEnabled();
    const product = await this.db.storeProduct.findUnique({
      where: { id: productId },
      include: { images: true },
    });
    if (!product) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }
    if (product.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Cannot add images to archived product", 400);
    }
    if (product.images.length >= STORE_MAX_IMAGES_PER_PRODUCT) {
      throw new AppError("VALIDATION_ERROR", "Image limit reached", 400);
    }

    const processed = await processStoreProductImageUpload(fileBuffer);
    const stored = await this.imageStorage.save(productId, processed.buffer, processed.contentType);
    const sortOrder =
      product.images.length > 0 ? Math.max(...product.images.map((i) => i.sortOrder)) + 1 : 0;

    const image = await this.db.storeProductImage.create({
      data: {
        productId,
        storageKey: stored.storageKey,
        contentType: processed.contentType,
        sortOrder,
      },
    });

    return {
      imageId: image.id,
      sortOrder: image.sortOrder,
      contentType: image.contentType,
    };
  }

  async deleteImage(_staff: User, productId: string, imageId: string) {
    this.assertEnabled();
    const image = await this.db.storeProductImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new AppError("NOT_FOUND", "Image not found", 404);
    }
    this.imageStorage.assertStorageKeyOwnedByProduct(image.storageKey, productId);
    await this.db.storeProductImage.delete({ where: { id: imageId } });
    await this.imageStorage.deleteByStorageKey(image.storageKey, productId);
    return { removed: true as const };
  }

  async updateImageSort(_staff: User, productId: string, imageId: string, sortOrder: number) {
    this.assertEnabled();
    const image = await this.db.storeProductImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new AppError("NOT_FOUND", "Image not found", 404);
    }
    await this.db.storeProductImage.update({
      where: { id: imageId },
      data: { sortOrder },
    });
    return { imageId, sortOrder };
  }

  private assertCompareAtPrice(priceCents: number, compareAtPriceCents: number | null) {
    if (compareAtPriceCents !== null && compareAtPriceCents < priceCents) {
      throw new AppError(
        "VALIDATION_ERROR",
        "compareAtPriceCents must be greater than or equal to priceCents",
        400,
      );
    }
  }

  private async assertVariantOptionsUnique(
    productId: string,
    sizeLabel: string | null,
    colorLabel: string | null,
    excludeVariantId: string | null,
  ) {
    const key = variantOptionKey(sizeLabel, colorLabel);
    const siblings = await this.db.storeProductVariant.findMany({
      where: {
        productId,
        isActive: true,
        ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
      },
    });
    for (const v of siblings) {
      if (variantOptionKey(v.sizeLabel, v.colorLabel) === key) {
        throw new AppError(
          "CONFLICT",
          "An active variant with the same size and color already exists",
          409,
        );
      }
    }
  }

  private async assertPublishEligible(productId: string) {
    const product = await this.db.storeProduct.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: { where: { isActive: true } },
        images: true,
      },
    });
    if (!product) {
      throw new AppError("NOT_FOUND", "Product not found", 404);
    }
    if (product.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Archived products cannot be published", 400);
    }
    if (!product.category.isActive) {
      throw new AppError("VALIDATION_ERROR", "Category is inactive", 400);
    }
    if (product.variants.length === 0) {
      throw new AppError("VALIDATION_ERROR", "At least one active variant is required", 400);
    }
    if (product.images.length === 0) {
      throw new AppError("VALIDATION_ERROR", "At least one product image is required", 400);
    }
    for (const v of product.variants) {
      if (v.priceCents < 0 || v.stockQuantity < 0) {
        throw new AppError("VALIDATION_ERROR", "Invalid variant price or stock", 400);
      }
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}
