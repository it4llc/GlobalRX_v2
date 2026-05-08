// /GlobalRX_v2/src/constants/order-status.ts

/**
 * Order status constants matching service statuses
 * These values are used throughout the application for consistency
 */

// Named-constant object — use this when writing a status value in code
// (mirrors the SERVICE_STATUSES pattern in service-status.ts).
export const ORDER_STATUSES = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PROCESSING: 'processing',
  MISSING_INFO: 'missing_info',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CANCELLED_DNB: 'cancelled_dnb'
} as const;

export const ORDER_STATUS_VALUES = [
  ORDER_STATUSES.DRAFT,
  ORDER_STATUSES.SUBMITTED,
  ORDER_STATUSES.PROCESSING,
  ORDER_STATUSES.MISSING_INFO,
  ORDER_STATUSES.COMPLETED,
  ORDER_STATUSES.CANCELLED,
  ORDER_STATUSES.CANCELLED_DNB
] as const;

export type OrderStatus = typeof ORDER_STATUS_VALUES[number];

/**
 * Display labels for order statuses
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  'draft': 'Draft',
  'submitted': 'Submitted',
  'processing': 'Processing',
  'missing_info': 'Missing Information',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
  'cancelled_dnb': 'Cancelled-DNB'
};

/**
 * CSS classes for status colors (defined in globals.css)
 */
export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  'draft': 'status-draft',
  'submitted': 'status-submitted',
  'processing': 'status-processing',
  'missing_info': 'status-missing_info',
  'completed': 'status-completed',
  'cancelled': 'status-cancelled',
  'cancelled_dnb': 'status-cancelled_dnb'
};