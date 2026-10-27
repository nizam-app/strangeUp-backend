import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { assertStoreAccess } from "./store-access.js";
import {
  STORE_CART_MAX_LINE_ITEMS,
  STORE_CART_MAX_QUANTITY,
  STORE_CHECKOUT_UNAVAILABLE,
} from "./store.constants.js";

type CartLineDto = {
  variantId: string;
  productId: string;
  productTitle: string;
  sku: string;
  sizeLabel: string | null;
  colorLabel: string | null;
  quantity: number;
  unitPriceCents: number;
  lineSubtotalCents: number;
  currency: string;
  stockQuantity: number;
  availability: "AVAILABLE" | "INSUFFICIENT_STOCK" | "UNAVAILABLE";
};

function lineAvailability(
  quantity: number,
  variant: { isActive: boolean; stockQuantity: number; product: { status: string } },
): CartLineDto["availability"] {
  if (variant.product.status !== "PUBLISHED" || !variant.isActive) {
    return "UNAVAILABLE";
  }
  if (variant.stockQuantity < quantity) {
    return "INSUFFICIENT_STOCK";
  }
  return "AVAILABLE";
}

export class StoreCartService {
  constructor(private readonly db: DatabaseClient) {}

  async getCart(user: User) {
    assertStoreAccess(user);
    return this.buildCartResponse(user.id);
  }

  async setCartItem(user: User, variantId: string, quantity: number) {
    assertStoreAccess(user);

    if (quantity === 0) {
      await this.db.storeCartItem.deleteMany({
        where: { userId: user.id, variantId },
      });
      return this.buildCartResponse(user.id);
    }

    if (quantity > STORE_CART_MAX_QUANTITY) {
      throw new AppError("VALIDATION_ERROR", "Quantity exceeds maximum allowed", 400);
    }

    const variant = await this.db.storeProductVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { status: true } } },
    });
    if (!variant || variant.product.status !== "PUBLISHED" || !variant.isActive) {
      throw new AppError("NOT_FOUND", "Variant not found", 404);
    }
    if (variant.stockQuantity < quantity) {
      throw new AppError("VALIDATION_ERROR", "Requested quantity exceeds available stock", 400);
    }

    await this.db.$transaction(async (tx) => {
      const existingCount = await tx.storeCartItem.count({ where: { userId: user.id } });
      const existingLine = await tx.storeCartItem.findUnique({
        where: { userId_variantId: { userId: user.id, variantId } },
      });
      if (!existingLine && existingCount >= STORE_CART_MAX_LINE_ITEMS) {
        throw new AppError("VALIDATION_ERROR", "Cart line limit reached", 400);
      }
      await tx.storeCartItem.upsert({
        where: { userId_variantId: { userId: user.id, variantId } },
        create: { userId: user.id, variantId, quantity },
        update: { quantity },
      });
    });

    return this.buildCartResponse(user.id);
  }

  async removeCartItem(user: User, variantId: string) {
    assertStoreAccess(user);
    await this.db.storeCartItem.deleteMany({
      where: { userId: user.id, variantId },
    });
    return this.buildCartResponse(user.id);
  }

  async clearCart(user: User) {
    assertStoreAccess(user);
    await this.db.storeCartItem.deleteMany({ where: { userId: user.id } });
    return this.buildCartResponse(user.id);
  }

  private async buildCartResponse(userId: string) {
    const items = await this.db.storeCartItem.findMany({
      where: { userId },
      include: {
        variant: {
          include: {
            product: { select: { id: true, title: true, status: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    let subtotalCents = 0;
    let currency: string | null = null;
    const lines: CartLineDto[] = [];

    for (const item of items) {
      const v = item.variant;
      const availability = lineAvailability(item.quantity, v);
      const lineSubtotal = availability === "UNAVAILABLE" ? 0 : v.priceCents * item.quantity;
      if (availability !== "UNAVAILABLE") {
        subtotalCents += lineSubtotal;
        currency = currency ?? v.currency;
        if (currency !== v.currency) {
          throw new AppError("VALIDATION_ERROR", "Mixed currencies in cart are not supported", 400);
        }
      }
      lines.push({
        variantId: v.id,
        productId: v.product.id,
        productTitle: v.product.title,
        sku: v.sku,
        sizeLabel: v.sizeLabel,
        colorLabel: v.colorLabel,
        quantity: item.quantity,
        unitPriceCents: v.priceCents,
        lineSubtotalCents: lineSubtotal,
        currency: v.currency,
        stockQuantity: v.stockQuantity,
        availability,
      });
    }

    return {
      items: lines,
      subtotalCents,
      currency,
      subtotalDisclaimer:
        "Subtotal uses current catalog prices and excludes tax, shipping, pickup, and membership discounts.",
      checkout: STORE_CHECKOUT_UNAVAILABLE,
    };
  }
}
