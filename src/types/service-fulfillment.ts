// /GlobalRX_v2/src/types/service-fulfillment.ts

import { ServiceStatus, SERVICE_STATUS_VALUES, SERVICE_STATUSES } from '@/constants/service-status';
import { z } from 'zod';

export interface ServiceFulfillment {
  id: string;
  orderId: string;
  orderItemId: string;
  serviceId: string;
  locationId: string;
  assignedVendorId: string | null;
  status: ServiceStatus;
  vendorNotes: string | null;
  internalNotes: string | null;
  assignedAt: Date | null;
  assignedBy: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Re-export for backward compatibility
export type { ServiceStatus };

// BUG FIX (March 20, 2026): Status values case normalization
// Problem: Database had mixed-case statuses (ALL CAPS, Title Case, lowercase) causing validation failures
// Solution: Migration normalized all statuses to lowercase, schemas now use lowercase constants
// This ensures consistent validation regardless of how status values are passed to the API
export const updateServiceStatusSchema = z.object({
  status: z.enum(SERVICE_STATUS_VALUES as [string, ...string[]]),
  comment: z.string().max(1000, 'Comment must be 1000 characters or less').optional(),
  confirmReopenTerminal: z.boolean().optional()
}).refine(
  (data) => {
    if (data.confirmReopenTerminal !== undefined && typeof data.confirmReopenTerminal !== 'boolean') {
      return false;
    }
    return true;
  },
  {
    message: 'Invalid confirmation value'
  }
);

// BUG FIX (March 20, 2026): Terminal status checking with lowercase constants
// Problem: Mixed-case statuses in database caused isTerminalStatus checks to fail
// Solution: Using lowercase constants ensures terminal status detection works correctly
// This prevents Add Comment button from being incorrectly disabled
const TERMINAL_STATUSES: string[] = [SERVICE_STATUSES.COMPLETED, SERVICE_STATUSES.CANCELLED, SERVICE_STATUSES.CANCELLED_DNB];
export const isTerminalStatus = (status: string): boolean => {
  return TERMINAL_STATUSES.includes(status);
};

export interface ServiceAuditLog {
  id: string;
  serviceFulfillmentId: string;
  orderId: string;
  userId: string;
  changeType: 'status_change' | 'vendor_assignment' | 'note_update' | 'bulk_assignment';
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  notes: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface ServiceFulfillmentWithRelations extends ServiceFulfillment {
  order?: {
    id: string;
    orderNumber: string;
    customerId: string;
  };
  orderItem?: {
    id: string;
    serviceId: string;
    locationId: string;
  };
  service?: {
    id: string;
    name: string;
    code: string;
  };
  location?: {
    id: string;
    name: string;
    code2: string;
  };
  assignedVendor?: {
    id: string;
    name: string;
    isActive: boolean;
  } | null;
  assignedByUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
}

export interface ServiceAuditLogWithUser extends ServiceAuditLog {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export interface ServiceQueryParams {
  orderId?: string;
  status?: ServiceStatus;
  vendorId?: string;
  limit?: number;
  offset?: number;
}

export interface BulkAssignRequest {
  serviceFulfillmentIds: string[];
  vendorId: string;
}

export interface UpdateServiceFulfillmentRequest {
  status?: ServiceStatus;
  assignedVendorId?: string | null;
  vendorNotes?: string;
  internalNotes?: string;
}

export interface ServiceFulfillmentListResponse {
  services: ServiceFulfillmentWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

// User and permission interfaces for service methods
export interface ServiceUser {
  id: string;
  userType: string;
  vendorId?: string;
  customerId?: string;
  permissions?: Record<string, unknown>;
}

export interface ServiceUserWithoutId {
  userType: string;
  vendorId?: string;
  customerId?: string;
  permissions?: Record<string, unknown>;
}

// Where clause type for Prisma queries
export interface ServiceWhereClause {
  orderId?: string;
  status?: ServiceStatus;
  assignedVendorId?: string;
}

// Update data type for service updates
export interface ServiceUpdateData {
  status?: ServiceStatus;
  assignedVendorId?: string | null;
  vendorNotes?: string | null;
  internalNotes?: string | null;
  assignedAt?: Date | null;
  assignedBy?: string | null;
  completedAt?: Date | null;
}

// Audit change tracking
export interface AuditChange {
  fieldName: string;
  changeType: 'status_change' | 'vendor_assignment' | 'note_update';
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}