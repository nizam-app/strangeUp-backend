export type CartLineAvailability = "AVAILABLE" | "INSUFFICIENT_STOCK" | "UNAVAILABLE";

export type CartLineAvailabilityReason =
  | "PRODUCT_NOT_PUBLISHED"
  | "VARIANT_INACTIVE"
  | "INSUFFICIENT_STOCK";

export type CartLineInput = {
  quantity: number;
  unitPriceCents: number;
  currency: string;
  variant: {
    isActive: boolean;
    stockQuantity: number;
    product: { status: string };
  };
};

export type ComputedCartLine = {
  availability: CartLineAvailability;
  availabilityReason: CartLineAvailabilityReason | null;
  /** Catalog price × requested quantity; 0 when line is UNAVAILABLE. */
  lineSubtotalCents: number;
  /** Fulfillable subtotal at current stock (used for cart `subtotalCents`). */
  eligibleLineSubtotalCents: number;
  /** Max quantity purchasable right now at catalog rules (0 when UNAVAILABLE). */
  maxPurchasableQuantity: number;
};

export type CartTotals = {
  /** Sum of eligibleLineSubtotalCents — not a checkout total; excludes tax/shipping/discounts. */
  subtotalCents: number;
  /** Sum of lineSubtotalCents for UI “priced lines” display (still not checkout-eligible). */
  linesSubtotalCents: number;
  eligibleLineCount: number;
  ineligibleLineCount: number;
  hasInsufficientStock: boolean;
  hasUnavailableLines: boolean;
  /** True only when every line is AVAILABLE (checkout API remains UNAVAILABLE separately). */
  allLinesPurchasable: boolean;
};

export function resolveCartLineAvailability(input: CartLineInput): ComputedCartLine {
  const { quantity, unitPriceCents, variant } = input;

  if (variant.product.status !== "PUBLISHED") {
    return unavailableLine("PRODUCT_NOT_PUBLISHED");
  }
  if (!variant.isActive) {
    return unavailableLine("VARIANT_INACTIVE");
  }
  if (variant.stockQuantity <= 0) {
    return {
      availability: "INSUFFICIENT_STOCK",
      availabilityReason: "INSUFFICIENT_STOCK",
      lineSubtotalCents: unitPriceCents * quantity,
      eligibleLineSubtotalCents: 0,
      maxPurchasableQuantity: 0,
    };
  }
  if (variant.stockQuantity < quantity) {
    return {
      availability: "INSUFFICIENT_STOCK",
      availabilityReason: "INSUFFICIENT_STOCK",
      lineSubtotalCents: unitPriceCents * quantity,
      eligibleLineSubtotalCents: unitPriceCents * variant.stockQuantity,
      maxPurchasableQuantity: variant.stockQuantity,
    };
  }

  const lineSubtotalCents = unitPriceCents * quantity;
  return {
    availability: "AVAILABLE",
    availabilityReason: null,
    lineSubtotalCents,
    eligibleLineSubtotalCents: lineSubtotalCents,
    maxPurchasableQuantity: variant.stockQuantity,
  };
}

function unavailableLine(
  reason: Exclude<CartLineAvailabilityReason, "INSUFFICIENT_STOCK">,
): ComputedCartLine {
  return {
    availability: "UNAVAILABLE",
    availabilityReason: reason,
    lineSubtotalCents: 0,
    eligibleLineSubtotalCents: 0,
    maxPurchasableQuantity: 0,
  };
}

export function aggregateCartTotals(
  lines: Pick<
    ComputedCartLine,
    "availability" | "lineSubtotalCents" | "eligibleLineSubtotalCents"
  >[],
): CartTotals {
  let subtotalCents = 0;
  let linesSubtotalCents = 0;
  let eligibleLineCount = 0;
  let ineligibleLineCount = 0;
  let hasInsufficientStock = false;
  let hasUnavailableLines = false;

  for (const line of lines) {
    linesSubtotalCents += line.lineSubtotalCents;
    subtotalCents += line.eligibleLineSubtotalCents;
    if (line.availability === "AVAILABLE") {
      eligibleLineCount += 1;
    } else {
      ineligibleLineCount += 1;
      if (line.availability === "INSUFFICIENT_STOCK") {
        hasInsufficientStock = true;
      }
      if (line.availability === "UNAVAILABLE") {
        hasUnavailableLines = true;
      }
    }
  }

  return {
    subtotalCents,
    linesSubtotalCents,
    eligibleLineCount,
    ineligibleLineCount,
    hasInsufficientStock,
    hasUnavailableLines,
    allLinesPurchasable: lines.length > 0 && ineligibleLineCount === 0,
  };
}
