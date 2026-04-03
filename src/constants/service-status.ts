// /GlobalRX_v2/src/constants/service-status.ts

/**
 * Service Status Constants
 *
 * These statuses are used for tracking the lifecycle of services in the fulfillment process.
 * They are used in:
 * - OrderItem.status (database) - Single source of truth for service status
 * - Comment Template availability filtering
 * - Service fulfillment UI
 */

// The actual status values used in the database and API (raw database format)
export const SERVICE_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PROCESSING: 'processing',
  MISSING_INFO: 'missing_info',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CANCELLED_DNB: 'cancelled_dnb'
} as const;

// TypeScript type for service status
export type ServiceStatus = typeof SERVICE_STATUSES[keyof typeof SERVICE_STATUSES];

// Array of all statuses for validation and dropdowns
export const SERVICE_STATUS_VALUES = Object.values(SERVICE_STATUSES);

// Display order for UI (workflow progression)
export const SERVICE_STATUS_DISPLAY_ORDER: ServiceStatus[] = [
  SERVICE_STATUSES.DRAFT,
  SERVICE_STATUSES.SUBMITTED,
  SERVICE_STATUSES.PROCESSING,
  SERVICE_STATUSES.MISSING_INFO,
  SERVICE_STATUSES.COMPLETED,
  SERVICE_STATUSES.CANCELLED,
  SERVICE_STATUSES.CANCELLED_DNB
];

// Status colors for UI display
export const SERVICE_STATUS_COLORS: Record<ServiceStatus, string> = {
  [SERVICE_STATUSES.DRAFT]: 'gray',
  [SERVICE_STATUSES.SUBMITTED]: 'blue',
  [SERVICE_STATUSES.PROCESSING]: 'yellow',
  [SERVICE_STATUSES.MISSING_INFO]: 'orange',
  [SERVICE_STATUSES.COMPLETED]: 'green',
  [SERVICE_STATUSES.CANCELLED]: 'red',
  [SERVICE_STATUSES.CANCELLED_DNB]: 'red'
};

// Helper function to validate a status string
export function isValidServiceStatus(status: string): status is ServiceStatus {
  return SERVICE_STATUS_VALUES.includes(status as ServiceStatus);
}

// Helper function to get display color for a status
export function getStatusColor(status: ServiceStatus): string {
  return SERVICE_STATUS_COLORS[status] || 'gray';
}