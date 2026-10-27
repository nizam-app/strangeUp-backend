export const STORE_LIST_DEFAULT_LIMIT = 20;
export const STORE_LIST_MAX_LIMIT = 50;
export const STORE_CART_MAX_QUANTITY = 99;
export const STORE_CART_MAX_LINE_ITEMS = 50;
export const STORE_PRODUCT_TITLE_MAX = 200;
export const STORE_PRODUCT_DESCRIPTION_MAX = 4000;
export const STORE_CHECKOUT_UNAVAILABLE = {
  status: "UNAVAILABLE" as const,
  reasonCode: "PAYMENT_AND_FULFILLMENT_NOT_CONFIGURED",
  message:
    "Checkout, payment, tax, shipping, pickup confirmation, and membership discounts are not configured.",
};
