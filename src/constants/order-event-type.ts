// /GlobalRX_v2/src/constants/order-event-type.ts

/**
 * Order event type constants for the OrderStatusHistory table
 * Used to categorize different types of events beyond just status changes
 */

export const ORDER_EVENT_TYPES = {
  STATUS_CHANGE: 'status_change',
  INVITATION_CREATED: 'invitation_created',
  INVITATION_RESENT: 'invitation_resent',
  INVITATION_EXTENDED: 'invitation_extended',
  INVITATION_EXPIRED: 'invitation_expired',
  INVITATION_OPENED: 'invitation_opened',
  COMMENT: 'comment'
} as const;

export type OrderEventType = typeof ORDER_EVENT_TYPES[keyof typeof ORDER_EVENT_TYPES];

// Array of all valid event type values for Zod enum validation
export const ORDER_EVENT_TYPE_VALUES = Object.values(ORDER_EVENT_TYPES);