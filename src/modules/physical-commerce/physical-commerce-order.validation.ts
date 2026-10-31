import { z } from "zod";

/** Future order write API — validated only; no route persists orders in 024D. */
export const physicalOrderIdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/);

export const physicalOrderShippingAddressSnapshotSchema = z.object({
  recipientName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(80),
  region: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().min(1).max(32),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Z]{2}$/),
});

export const physicalOrderFulfillmentSelectionSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("SHIPPING"),
    address: physicalOrderShippingAddressSnapshotSchema,
  }),
  z.object({
    method: z.literal("ACTIVITY_PICKUP"),
    activityId: z.string().uuid(),
  }),
]);

export const physicalOrderLineSnapshotSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  unitPriceCents: z.number().int().min(0),
  currency: z.string().length(3),
});

export type PhysicalOrderFulfillmentSelection = z.infer<
  typeof physicalOrderFulfillmentSelectionSchema
>;
