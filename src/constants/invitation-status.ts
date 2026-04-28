// /GlobalRX_v2/src/constants/invitation-status.ts

/**
 * Invitation status constants following the existing pattern from service-status.ts
 * All status values must be lowercase per project standards
 */

export const INVITATION_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent',
  ACCESSED: 'accessed',  // Database uses 'accessed' not 'in_progress'
  COMPLETED: 'completed',
  EXPIRED: 'expired'
} as const;

export type InvitationStatus = typeof INVITATION_STATUSES[keyof typeof INVITATION_STATUSES];

// Array of all valid status values for Zod enum validation
export const INVITATION_STATUS_VALUES = Object.values(INVITATION_STATUSES);