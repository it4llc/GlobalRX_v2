/**
 * Order status constants matching service statuses
 * These values are used throughout the application for consistency
 */

export const ORDER_STATUS_VALUES = [
  'draft',
  'submitted',
  'processing',
  'missing_info',
  'completed',
  'cancelled',
  'cancelled_dnb'
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