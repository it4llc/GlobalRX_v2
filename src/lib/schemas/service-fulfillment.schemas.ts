// /GlobalRX_v2/src/lib/schemas/service-fulfillment.schemas.ts

import { z } from 'zod';
import { SERVICE_STATUS_VALUES } from '@/constants/service-status';

// Service status enum schema - uses the constants for validation
export const serviceStatusSchema = z.enum([
  'Draft',
  'Submitted',
  'Processing',
  'Missing Information',
  'Completed',
  'Cancelled',
  'Cancelled-DNB'
] as const);

// Change type enum schema for audit logging
export const changeTypeSchema = z.enum([
  'status_change',
  'vendor_assignment',
  'note_update'
]);

// Schema for updating service fulfillment
export const updateServiceFulfillmentSchema = z.object({
  status: serviceStatusSchema.optional(),
  assignedVendorId: z.string().uuid().nullable().optional(),
  vendorNotes: z.string().max(5000).optional(),
  internalNotes: z.string().max(5000).optional(),
});

// Schema for bulk assignment
export const bulkAssignSchema = z.object({
  serviceFulfillmentIds: z.array(z.string().uuid()).min(1).max(100),
  vendorId: z.string().uuid(),
});

// Schema for querying services
export const serviceQuerySchema = z.object({
  orderId: z.string().uuid().optional(),
  status: serviceStatusSchema.optional(),
  vendorId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// Schema for order closure
export const closeOrderSchema = z.object({
  comments: z.string().min(1).max(5000),
});

// Derived TypeScript types from schemas
export type UpdateServiceFulfillmentInput = z.infer<typeof updateServiceFulfillmentSchema>;
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;
export type ServiceQueryInput = z.infer<typeof serviceQuerySchema>;
export type CloseOrderInput = z.infer<typeof closeOrderSchema>;
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type ChangeType = z.infer<typeof changeTypeSchema>;