// /GlobalRx_v2/src/lib/schemas/serviceStatusSchemas.ts

import { z } from 'zod';

import { formatServiceStatus } from '@/lib/status-utils';
import { SERVICE_STATUSES, SERVICE_STATUS_VALUES } from '@/constants/service-status';

// Service status enum matching database values (lowercase to match DB)
// Uses the single source of truth from service-status.ts
export const ServiceStatusEnum = z.enum([
  SERVICE_STATUSES.DRAFT,
  SERVICE_STATUSES.PENDING,
  SERVICE_STATUSES.SUBMITTED,
  SERVICE_STATUSES.PROCESSING,
  SERVICE_STATUSES.MISSING_INFO,
  SERVICE_STATUSES.COMPLETED,
  SERVICE_STATUSES.CANCELLED,
  SERVICE_STATUSES.CANCELLED_DNB
]);

export type ServiceStatus = z.infer<typeof ServiceStatusEnum>;

// Terminal statuses that require confirmation to reopen
export const TERMINAL_STATUSES: ServiceStatus[] = ['completed', 'cancelled', 'cancelled_dnb'];

// Re-export service status values from the single source of truth for test compatibility
export { SERVICE_STATUS_VALUES };

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
// Delegates to centralized status utils for consistency
export function formatStatusDisplay(status: string): string {
  return formatServiceStatus(status);
}

// Helper to get status color class
// Uses lowercase status values to match database
export function getStatusColorClass(status: string): string {
  // Normalize to lowercase for comparison
  const normalizedStatus = status.toLowerCase();

  switch (normalizedStatus) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'pending':
    case 'submitted':
      return 'bg-blue-100 text-blue-800';
    case 'processing':
      return 'bg-yellow-100 text-yellow-800';
    case 'missing_info':
    case 'missing information':
      return 'bg-orange-100 text-orange-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
    case 'cancelled_dnb':
    case 'cancelled-dnb':
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