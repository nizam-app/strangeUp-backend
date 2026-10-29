import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { assertStoreAccess } from "./store-access.js";
import {
  aggregateCartTotals,
  resolveCartLineAvailability,
  type CartLineAvailability,
  type CartLineAvailabilityReason,
} from "./store-cart-lines.js";
import {
  STORE_CART_MAX_LINE_ITEMS,
  STORE_CART_MAX_QUANTITY,
  STORE_CHECKOUT_UNAVAILABLE,
  STORE_SUBTOTAL_DISCLAIMER,
} from "./store.constants.js";
import { buildStoreCartFulfillmentQuote } from "../physical-commerce/physical-commerce-fulfillment.service.js";
import { assessCartOrderReadiness } from "../physical-commerce/physical-commerce-order-readiness.js";
import { buildStoreCartPricingQuote } from "./store-pricing.service.js";

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
  eligibleLineSubtotalCents: number;
  maxPurchasableQuantity: number;
  currency: string;
  stockQuantity: number;
  availability: CartLineAvailability;
  availabilityReason: CartLineAvailabilityReason | null;
};

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

    let currency: string | null = null;
    const lines: CartLineDto[] = [];
    const computedForTotals: Parameters<typeof aggregateCartTotals>[0] = [];

    for (const item of items) {
      const v = item.variant;
      const computed = resolveCartLineAvailability({
        quantity: item.quantity,
        unitPriceCents: v.priceCents,
        currency: v.currency,
        variant: v,
      });

      if (computed.availability !== "UNAVAILABLE") {
        currency = currency ?? v.currency;
        if (currency !== v.currency) {
          throw new AppError("VALIDATION_ERROR", "Mixed currencies in cart are not supported", 400);
        }
      }

      computedForTotals.push(computed);
      lines.push({
        variantId: v.id,
        productId: v.product.id,
        productTitle: v.product.title,
        sku: v.sku,
        sizeLabel: v.sizeLabel,
        colorLabel: v.colorLabel,
        quantity: item.quantity,
        unitPriceCents: v.priceCents,
        lineSubtotalCents: computed.lineSubtotalCents,
        eligibleLineSubtotalCents: computed.eligibleLineSubtotalCents,
        maxPurchasableQuantity: computed.maxPurchasableQuantity,
        currency: v.currency,
        stockQuantity: v.stockQuantity,
        availability: computed.availability,
        availabilityReason: computed.availabilityReason,
      });
    }

    const totals = aggregateCartTotals(computedForTotals);
    const orderReadiness = assessCartOrderReadiness(
      lines.map((line) => ({
        variantId: line.variantId,
        availability: line.availability,
        availabilityReason: line.availabilityReason,
        quantity: line.quantity,
        maxPurchasableQuantity: line.maxPurchasableQuantity,
      })),
    );

    return {
      items: lines,
      subtotalCents: totals.subtotalCents,
      linesSubtotalCents: totals.linesSubtotalCents,
      currency,
      summary: {
        eligibleLineCount: totals.eligibleLineCount,
        ineligibleLineCount: totals.ineligibleLineCount,
        hasInsufficientStock: totals.hasInsufficientStock,
        hasUnavailableLines: totals.hasUnavailableLines,
        allLinesPurchasable: totals.allLinesPurchasable,
      },
      pricingQuote: buildStoreCartPricingQuote({
        userId,
        catalogSubtotalCents: totals.subtotalCents,
        currency,
      }),
      fulfillment: buildStoreCartFulfillmentQuote(),
      orderReadiness,
      subtotalDisclaimer: STORE_SUBTOTAL_DISCLAIMER,
      checkout: STORE_CHECKOUT_UNAVAILABLE,
    };
  }
}
