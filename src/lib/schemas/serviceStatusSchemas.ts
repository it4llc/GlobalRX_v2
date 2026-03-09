// /GlobalRX_v2/src/lib/schemas/serviceStatusSchemas.ts

import { z } from 'zod';

// Service status enum matching database values
export const ServiceStatusEnum = z.enum([
  'Draft',
  'Submitted',
  'Processing',
  'Missing Information',
  'Completed',
  'Cancelled',
  'Cancelled-DNB'
]);

export type ServiceStatus = z.infer<typeof ServiceStatusEnum>;

// Terminal statuses that require confirmation to reopen
export const TERMINAL_STATUSES: ServiceStatus[] = ['Completed', 'Cancelled', 'Cancelled-DNB'];

// Export service status values for test compatibility
export const SERVICE_STATUS_VALUES = [
  'Draft',
  'Submitted',
  'Processing',
  'Missing Information',
  'Completed',
  'Cancelled',
  'Cancelled-DNB'
] as const;

// Schema for updating service status via API
export const updateServiceStatusSchema = z.object({
  status: ServiceStatusEnum,
  comment: z.string().max(1000, 'Comment must be 1000 characters or less').optional(),
  confirmReopenTerminal: z.boolean().optional().describe('Confirm reopening a terminal status')
});

// Export with alternative name for tests
export const serviceStatusUpdateSchema = updateServiceStatusSchema;

export type UpdateServiceStatusInput = z.infer<typeof updateServiceStatusSchema>;

// Schema for status change audit entry
export const statusChangeAuditSchema = z.object({
  orderItemId: z.string().uuid(),
  userId: z.string().uuid().optional(), // For test compatibility
  createdBy: z.string().uuid().optional(), // The actual field used
  isStatusChange: z.literal(true),
  statusChangedFrom: ServiceStatusEnum,
  statusChangedTo: ServiceStatusEnum,
  comment: z.string().optional().nullable(),
  createdAt: z.string().datetime().or(z.date()).transform(val => new Date(val))
});

export type StatusChangeAudit = z.infer<typeof statusChangeAuditSchema>;

// Export with alternative name for tests
export const statusChangeCommentSchema = statusChangeAuditSchema;

// Schema for order lock
export const orderLockSchema = z.object({
  orderId: z.string().uuid(),
  lockedBy: z.string().uuid(),
  lockedAt: z.string().datetime().or(z.date()).transform(val => new Date(val)),
  lockExpires: z.string().datetime().or(z.date()).transform(val => new Date(val))
});

// Helper to check if a status is terminal
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as ServiceStatus);
}

// Helper to format status for display
export function formatStatusDisplay(status: string): string {
  // Handle special cases
  if (status === 'Cancelled-DNB') {
    return 'Cancelled (DNB)';
  }
  return status;
}

// Helper to get status color class
export function getStatusColorClass(status: string): string {
  switch (status) {
    case 'Draft':
      return 'bg-gray-100 text-gray-800';
    case 'Submitted':
      return 'bg-blue-100 text-blue-800';
    case 'Processing':
      return 'bg-yellow-100 text-yellow-800';
    case 'Missing Information':
      return 'bg-orange-100 text-orange-800';
    case 'Completed':
      return 'bg-green-100 text-green-800';
    case 'Cancelled':
    case 'Cancelled-DNB':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Helper to validate status transition (for future use if business rules are added)
export function canTransitionStatus(from: string, to: string): { allowed: boolean; reason?: string } {
  // Phase 2d: All transitions are allowed
  // This function exists for future phases where business rules might restrict certain transitions
  return { allowed: true };
}