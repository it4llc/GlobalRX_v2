// /GlobalRX_v2/src/lib/schemas/service-order-data.schemas.ts

import { z } from 'zod';

/**
 * Schema for order data field values
 * Business Rule 9: Field values returned exactly as stored (no transformation)
 * Data Requirement: Max 5000 chars per field value
 */
const orderDataValueSchema = z.union([
  z.string().max(5000),
  z.null()
]);

/**
 * Schema for order data object
 * Business Rule 2: Return data as flat key-value pairs
 * Business Rule 8: If no order data exists, orderData should be empty object
 */
export const orderDataSchema = z.record(
  z.string(),
  orderDataValueSchema
);

/**
 * Schema for service details with order data included
 * Business Rule 7: Order data returned as part of existing service response
 * Business Rule 8: orderData must be object, not null or undefined
 */
export const serviceDetailsWithOrderDataSchema = z.object({
  // Required service fields
  id: z.string(),
  orderId: z.string(),
  orderItemId: z.string().nullable(),
  serviceId: z.string(),
  locationId: z.string(),
  status: z.enum(['pending', 'submitted', 'processing', 'completed', 'cancelled']),

  // Optional service fields
  assignedVendorId: z.string().nullable().optional(),
  vendorNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  assignedAt: z.date().nullable().optional(),
  assignedBy: z.string().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),

  // Related data (optional for partial responses)
  order: z.unknown().optional(),
  orderItem: z.unknown().optional(),
  service: z.unknown().optional(),
  location: z.unknown().optional(),
  assignedVendor: z.unknown().optional(),

  // Order data field - always required as object, never null
  // Business Rule 1: Order data must be included for ALL service types
  orderData: orderDataSchema
});

export type ServiceDetailsWithOrderData = z.infer<typeof serviceDetailsWithOrderDataSchema>;
export type OrderData = z.infer<typeof orderDataSchema>;