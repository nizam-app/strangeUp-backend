import type {
  CartLineAvailability,
  CartLineAvailabilityReason,
} from "../store/store-cart-lines.js";
import { STORE_ORDER_PLACEMENT_UNAVAILABLE } from "./physical-commerce.constants.js";
import type {
  StoreOrderReadinessBlockedLineDto,
  StoreOrderReadinessDto,
} from "./physical-commerce.types.js";

export type CartLineOrderReadinessInput = {
  variantId: string;
  availability: CartLineAvailability;
  availabilityReason: CartLineAvailabilityReason | null;
  quantity: number;
  maxPurchasableQuantity: number;
};

function blockReasonForLine(
  line: CartLineOrderReadinessInput,
): StoreOrderReadinessBlockedLineDto["blockReasonCode"] {
  if (line.availability === "INSUFFICIENT_STOCK") {
    return "INSUFFICIENT_STOCK";
  }
  if (line.availability === "UNAVAILABLE") {
    if (line.availabilityReason === "PRODUCT_NOT_PUBLISHED") {
      return "PRODUCT_NOT_PUBLISHED";
    }
    if (line.availabilityReason === "VARIANT_INACTIVE") {
      return "VARIANT_INACTIVE";
    }
    return "LINE_NOT_FULLY_AVAILABLE";
  }
  if (line.quantity > line.maxPurchasableQuantity) {
    return "INSUFFICIENT_STOCK";
  }
  return "LINE_NOT_FULLY_AVAILABLE";
}

function messageForBlock(code: StoreOrderReadinessBlockedLineDto["blockReasonCode"]): string {
  switch (code) {
    case "INSUFFICIENT_STOCK":
      return "Requested quantity exceeds on-hand stock; reduce quantity or remove line before any future order placement.";
    case "PRODUCT_NOT_PUBLISHED":
      return "Product is no longer published.";
    case "VARIANT_INACTIVE":
      return "Variant is inactive.";
    default:
      return "Line is not eligible for order snapshot.";
  }
}

export function assessCartOrderReadiness(
  lines: CartLineOrderReadinessInput[],
): StoreOrderReadinessDto {
  const blockedLines: StoreOrderReadinessBlockedLineDto[] = [];

  for (const line of lines) {
    if (line.availability !== "AVAILABLE") {
      const blockReasonCode = blockReasonForLine(line);
      blockedLines.push({
        variantId: line.variantId,
        availability: line.availability,
        blockReasonCode,
        message: messageForBlock(blockReasonCode),
      });
    } else if (line.quantity > line.maxPurchasableQuantity) {
      blockedLines.push({
        variantId: line.variantId,
        availability: line.availability,
        blockReasonCode: "INSUFFICIENT_STOCK",
        message: messageForBlock("INSUFFICIENT_STOCK"),
      });
    }
  }

  const cartLinesOrderEligible = lines.length > 0 && blockedLines.length === 0;
  const allLinesFullyAvailable =
    lines.length > 0 && lines.every((l) => l.availability === "AVAILABLE");

  if (lines.length === 0) {
    return {
      placementStatus: STORE_ORDER_PLACEMENT_UNAVAILABLE.placementStatus,
      reasonCode: STORE_ORDER_PLACEMENT_UNAVAILABLE.reasonCode,
      message: STORE_ORDER_PLACEMENT_UNAVAILABLE.message,
      allLinesFullyAvailable: false,
      cartLinesOrderEligible: false,
      blockedLines: [],
      stockSnapshotPolicy: "REQUIRE_FULL_AVAILABLE_QUANTITY_PER_LINE",
      insufficientStockNeverAutoReduced: true,
    };
  }

  if (!cartLinesOrderEligible) {
    return {
      placementStatus: "UNAVAILABLE",
      reasonCode: "CART_LINES_NOT_ORDER_READY",
      message:
        "Cart contains lines that are not fully available at requested quantity. Orders must not silently cap quantity to on-hand stock.",
      allLinesFullyAvailable,
      cartLinesOrderEligible: false,
      blockedLines,
      stockSnapshotPolicy: "REQUIRE_FULL_AVAILABLE_QUANTITY_PER_LINE",
      insufficientStockNeverAutoReduced: true,
    };
  }

  return {
    placementStatus: STORE_ORDER_PLACEMENT_UNAVAILABLE.placementStatus,
    reasonCode: STORE_ORDER_PLACEMENT_UNAVAILABLE.reasonCode,
    message: STORE_ORDER_PLACEMENT_UNAVAILABLE.message,
    allLinesFullyAvailable,
    cartLinesOrderEligible: lines.length > 0,
    blockedLines,
    stockSnapshotPolicy: "REQUIRE_FULL_AVAILABLE_QUANTITY_PER_LINE",
    insufficientStockNeverAutoReduced: true,
  };
}
