// /GlobalRX_v2/src/lib/schemas/orderStatusSchemas.ts

import { z } from 'zod';

// The seven standardized order status values matching service statuses
export const ORDER_STATUS_VALUES = [
  'draft',
  'submitted',
  'processing',
  'missing_info',
  'completed',
  'cancelled',
  'cancelled_dnb'
] as const;

// Type for order status
export type OrderStatus = typeof ORDER_STATUS_VALUES[number];

// Schema for updating order status via API
export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES, {
    errorMap: () => ({ message: 'Invalid enum value' })
  }),
  reason: z.string().max(500, 'Reason must not exceed 500 characters').optional(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional()
});

// Schema for order status history entries
export const orderStatusHistorySchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  fromStatus: z.enum(ORDER_STATUS_VALUES).nullable(), // null for initial status
  toStatus: z.enum(ORDER_STATUS_VALUES),
  changedBy: z.string().min(1, 'Changed by is required'),
  isAutomatic: z.boolean(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(500).optional()
});

// Type exports derived from schemas
export type OrderStatusUpdate = z.infer<typeof orderStatusUpdateSchema>;
export type OrderStatusHistory = z.infer<typeof orderStatusHistorySchema>;